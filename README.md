# **BruceSky**

- Tired of staring at the same boring profile banner all day or can't decide between a handful?
- BruceSky can rotate them out for you; switch it up **hourly**, **daily**, **weekly**, **biweekly**, or **monthly**. 
- Banners are chosen randomly, preferring those that were least recently used. 

## **What It Does**
BruceSky:
- Scans a `Banners` folder for `.jpg`, `.jpeg`, or `.png` images.
- Keeps track of when each banner was last used.
- Picks a new banner at your chosen schedule, with a preference for the least recently used ones.
- Crops and uploads it to your profile using the Bluesky API.


---

## **Setup**
BruceSky requires [NodeJS](https://nodejs.org/en).

### 1. Clone or download this repo
   ```sh
   git clone https://github.com/Seglectic/BruceSky.git
   ```
### 2. Create a free Bluesky "App Password"
 - Go to [Bluesky>Settings>Privacy&Security>App Passwords](https://bsky.app/settings/app-passwords)
 - Create an App Password with whatever name you want (probably BruceSky)
 - Copy your password and copy or save it somewhere safe. (bsky won't tell you this password again)
### 3. Install NPM packages
   ```sh
   npm install
   ```
### 4. Prepare your Environment
   Create a .env file in the root directory with these variables:
   ```env
BRUCESKY_SCHEDULE=    hourly                     # Options: hourly, daily, weekly, biweekly, monthly
BLUESKY_IDENTIFIER=   your-handle.bsky.social
BLUESKY_APP_PASSWORD= your-app-password
   ```
- Note: If you use a custom domain for your handle, simply use the domain as your identifier
### 5. Add your Banners
- Place your .jpg, .jpeg, or .png images in the Banners folder (create it if it doesn't exist).

## Running BruceSky
- To start:
```bash
node bruceSky.js
```
- *By default, BruceSky uses the schedule defined in your .env file. It'll run continuously.*
- *Named after our favorite green Banner*
