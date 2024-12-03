const { AtpAgent } = require('@atproto/api');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const schedule = require('node-schedule');

const BANNER_FOLDER = './Banners';
const BANNER_DATA_FILE = './bannerData.json';

// Function to scan the Banners folder and update bannerData.json, returns all found images
function loadBanners() {
  const files = fs.readdirSync(BANNER_FOLDER);
  const bannerData = [];

  // Read existing data if it exists
  if (fs.existsSync(BANNER_DATA_FILE)) {
    const existingData = JSON.parse(fs.readFileSync(BANNER_DATA_FILE, 'utf8'));
    // Mark all existing entries as not found initially
    existingData.forEach((entry) => (entry.found = false));
    bannerData.push(...existingData);
  }

  files.forEach((file) => {
    const filePath = path.join(BANNER_FOLDER, file);
    const ext = path.extname(file).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      let bannerEntry = bannerData.find((entry) => entry.path === filePath);

      if (!bannerEntry) {
        bannerEntry = { path: filePath, lastUsed: 0, found: true };
        bannerData.push(bannerEntry);
      } else {
        bannerEntry.found = true; // Mark as found
      }
    }
  });

  // Remove entries for files no longer present
  const filteredData = bannerData.filter((entry) => entry.found);

  // Save updated banner data to disk
  fs.writeFileSync(BANNER_DATA_FILE, JSON.stringify(filteredData, null, 2), 'utf8');
  
  // Report which banners were located
  console.log('Banners found:');
  filteredData.forEach((entry)=>{
    console.log(`⭕ ${entry.path}`);
  })

  return filteredData;
}

// Does the hard work of actually sending the banner data to bsky after cropping the image
async function updateBanner(bannerEntry) {
  const report = [];
  const currentTime = new Date().toISOString(); // Get the current time in ISO format
  report.push(`Update Report - ${currentTime}`);

  try {
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: process.env.BLUESKY_IDENTIFIER,
      password: process.env.BLUESKY_APP_PASSWORD,
    });
    report.push('✅ Authenticated successfully');

    const ext = path.extname(bannerEntry.path).toLowerCase();
    const resizedImagePath = './resized-banner.jpg';

    // Process the image
    let sharpPipeline = sharp(bannerEntry.path);
    if (ext === '.png') {
      sharpPipeline = sharpPipeline.png();
    } else if (ext === '.jpg' || ext === '.jpeg') {
      sharpPipeline = sharpPipeline.jpeg();
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    await sharpPipeline
      .resize(1500, 500, { fit: 'cover', position: 'center' })
      .toFile(resizedImagePath);
    report.push(`✅ Image processed successfully (resized and saved to ${resizedImagePath})`);

    // Read the resized image and upload it
    const imageData = fs.readFileSync(resizedImagePath);
    const uploadResponse = await agent.uploadBlob(imageData, {
      encoding: ext === '.png' ? 'image/png' : 'image/jpeg',
    });
    report.push(`✅ Banner uploaded successfully with blob reference: ${uploadResponse.data.blob.ref}`);

    // Update the profile with the uploaded banner
    await agent.upsertProfile((existingProfile) => ({
      ...existingProfile,
      banner: uploadResponse.data.blob,
    }));
    report.push('✅ Profile banner updated successfully');

    // Update lastUsed timestamp for the banner
    bannerEntry.lastUsed = Math.floor(Date.now() / 1000);
    const bannerData = JSON.parse(fs.readFileSync('./bannerData.json', 'utf8'));
    const updatedData = bannerData.map((entry) =>
      entry.path === bannerEntry.path ? bannerEntry : entry
    );
    fs.writeFileSync('./bannerData.json', JSON.stringify(updatedData, null, 2), 'utf8');
    report.push(`✅ Updated banner metadata with lastUsed: ${bannerEntry.lastUsed}`);

  } catch (error) {
    report.push(`❌ Error: ${error.response?.data || error.message}`);
  }

  // Print the full report
  console.log(report.join('\n'));
}


// Main function
async function bruceSky(scheduleType) {
  const banners = loadBanners();
  if (banners.length === 0) {
    console.error('No banners available to update.');
    return;
  }

  let job;
  switch (scheduleType) {
    case 'hourly':
      // Schedule to run at the top of every hour
      job = schedule.scheduleJob('0 * * * *', async () => {
        const banner = getNextBanner(banners);
        await updateBanner(banner);
      });
      break;

    case 'daily':
      // Schedule to run daily at midnight
      job = schedule.scheduleJob('0 0 * * *', async () => {
        const banner = getNextBanner(banners);
        await updateBanner(banner);
      });
      break;

    case 'weekly':
      // Schedule to run weekly on Sunday at midnight
      job = schedule.scheduleJob('0 0 * * 0', async () => {
        const banner = getNextBanner(banners);
        await updateBanner(banner);
      });
      break;

    case 'biweekly':
      // Schedule to run every other Sunday at midnight
      job = schedule.scheduleJob('0 0 * * 0', async (fireDate) => {
        const weekNumber = getWeekNumber(fireDate);
        if (weekNumber % 2 === 0) {
          const banner = getNextBanner(banners);
          await updateBanner(banner);
        }
      });
      break;

    case 'monthly':
      // Schedule to run on the first day of the month at midnight
      job = schedule.scheduleJob('0 0 1 * *', async () => {
        const banner = getNextBanner(banners);
        await updateBanner(banner);
      });
      break;

    default:
      console.error('Invalid schedule type. Use "hourly", "daily", "weekly", "biweekly", or "monthly".');
      return;
  }
  if(scheduleType==='hourly'){
    console.log(`BruceSky is now running on an hourly schedule.`);
  }else{
    console.log(`BruceSky is now running on a ${scheduleType} schedule.`);
  }
}

// Fetch the next banner to be used
function getNextBanner(banners) {
  // Sort banners by `lastUsed` (ascending, least recently used first)
  banners.sort((a, b) => a.lastUsed - b.lastUsed);

  // Assign weights based on position in the sorted list
  const totalWeight = banners.length * (banners.length + 1) / 2; // Sum of weights 1 + 2 + ... + N
  const weightedBanners = banners.map((banner, index) => ({
    ...banner,
    weight: banners.length - index, // Higher weight for least recently used
  }));

  // Pick a random banner based on weights
  const randomValue = Math.random() * totalWeight;
  let cumulativeWeight = 0;
  for (const banner of weightedBanners) {
    cumulativeWeight += banner.weight;
    if (randomValue <= cumulativeWeight) {
      return banner;
    }
  }

  // Fallback (shouldn't happen)
  return banners[0];
}

// Helper: Get the ISO week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Entry point (uses environment variable or defaults to hourly)
(async () => {
  const scheduleType = process.env.BRUCESKY_SCHEDULE || 'hourly';
  await bruceSky(scheduleType);
})();