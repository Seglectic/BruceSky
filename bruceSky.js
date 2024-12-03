const { AtpAgent } = require('@atproto/api');
const sharp = require('sharp');
const fs = require('fs');
require('dotenv').config();


async function processImage(inputPath, outputPath) {
  try {
    // Resize and crop to maintain aspect ratio
    await sharp(inputPath)
      .resize(1500, 500, {  // Target dimensions
        fit: 'cover',       // Ensures image fills the dimmies
        position: 'center', // Center crop
      })
      .jpeg({ quality: 100 }) // Compress to reduce file size
      .toFile(outputPath);

    console.log('Image processed!');
  } catch (error) {
    throw new Error('Error processing the image: ' + error.message);
  }
}

async function bruceSky() {
  try {
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: process.env.BLUESKY_IDENTIFIER,
      password: process.env.BLUESKY_APP_PASSWORD,
    });

    console.log('Authenticated!');

    const inputImagePath = 'banner.jpg'; // Replace with your image path
    const resizedImagePath = 'resized-banner.jpg'; // Output for the processed image

    // Resize and crop the image
    await processImage(inputImagePath, resizedImagePath);

    // Read the processed banner
    const imageData = fs.readFileSync(resizedImagePath);

    // Upload the processed banner image
    const uploadResponse = await agent.uploadBlob(imageData, {
      encoding: 'image/jpeg',
    });

    
    console.log('Banner uploaded.');

    // Extract rate limit info from the response
    const headers = uploadResponse.headers;
    const limit = parseInt(headers['ratelimit-limit'], 10);
    const remaining = parseInt(headers['ratelimit-remaining'], 10);
    const resetTimestamp = parseInt(headers['ratelimit-reset'], 10);

    // Calculate time until reset
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const secondsUntilReset = resetTimestamp - now;
    const hours = Math.floor(secondsUntilReset / 3600);
    const minutes = Math.floor((secondsUntilReset % 3600) / 60);

    console.log(`Requests remaining: ${remaining}/${limit}`);
    console.log(`Time until reset: ${hours} hours, ${minutes} minutes`);


    // Update your profile with the new banner
    await agent.upsertProfile((existingProfile) => ({
      ...existingProfile,
      banner: uploadResponse.data.blob,
    }));

    console.log('Profile banner updated!');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

bruceSky();