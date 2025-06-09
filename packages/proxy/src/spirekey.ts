// const express = require('express');
// const open = require('open');
// const axios = require('axios');

// const app = express();
// const port = 3000; // Port for our local server

// // Endpoint to start the OAuth flow
// app.get('/start-auth', async (req, res) => {
//   // Construct the OAuth URL here. Adjust the parameters as necessary.
//   const clientId = 'YOUR_CLIENT_ID';
//   const redirectUri = `http://localhost:${port}/callback`;
//   const authUrl = `https://your-oauth-provider.com/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;

//   // Open the default browser to initiate the auth flow
//   await open(authUrl);
//   res.send('Authentication process has started in your browser.');
// });

// // Callback endpoint to handle the redirect from the OAuth provider
// app.get('/callback', async (req, res) => {
//   const { code } = req.query; // You might receive a code or a token, depending on the flow

//   // Exchange the code for a token if necessary (not shown here)
//   // const tokenResponse = await axios.post('https://your-oauth-provider.com/token', {
//   //     code,
//   //     redirect_uri: redirectUri,
//   //     client_id: clientId,
//   //     client_secret: 'YOUR_CLIENT_SECRET',
//   //     grant_type: 'authorization_code'
//   // });

//   // const token = tokenResponse.data.access_token;

//   console.log('OAuth token:', code); // Or use the token variable from above
//   res.send('Authentication successful! You can close this window.');

//   // Optionally, shutdown the server after successful auth
//   process.exit();
// });

// Start the server
// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`);
// });
// export const SPIRE_KEY_URL = 'https://spirekey.kadena.io';
// export interface SpireKeyServerOptions {
//   url?: string;
// }
// export function createSpireKeyNodeWallet({ url = SPIRE_KEY_URL }: SpireKeyServerOptions = {}) {
//   const app = createApp();
//   const router = createRouter();
// }

export {};
