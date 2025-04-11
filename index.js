require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

// Load client secrets from credentials.json
const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];
const TOKEN_PATH = "token.json";
const youtubeChannelID = process.env.YOUTUBE_CHANNEL_ID; // Replace with your video ID

// Load OAuth 2.0 client
async function authorize() {
    const credentials = JSON.parse(fs.readFileSync("credentials.json"));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if token already exists
    if (fs.existsSync(TOKEN_PATH)) {
        oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
        return oAuth2Client;
    }

    return await getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
        });

        console.log("Authorize this app by visiting this URL:", authUrl);
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        rl.question("Enter the code from that page here: ", (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    console.error("Error retrieving access token", err);
                    reject(err);
                    return;
                }
                oAuth2Client.setCredentials(token);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                console.log("Token stored to", TOKEN_PATH);
                resolve(oAuth2Client);
            });
        });
    });
}

// Fetch comments
async function fetchComments(auth, VIDEO_ID) {
    const youtube = google.youtube({ version: "v3", auth });

    try {
        const response = await youtube.commentThreads.list({
            part: "snippet",
            videoId: VIDEO_ID,
            maxResults: 100,
        });

        const spamComments = [];

        response.data.items.forEach((item) => {
            const comment = item.snippet.topLevelComment.snippet;
            const commentText = comment.textDisplay;
            const commentId = item.id;

            console.log(`Checking comment: "${commentText}"`);

            if (getJudolComment(commentText)) {
                console.log(`🚨 Spam detected: "${commentText}"`);
                spamComments.push(commentId);
            }
            
        });

        return spamComments;
    } catch (error) {
        console.error("Error fetching comments:", error);
        return [];
    }
}


function getJudolComment(text) {
    const normalizedText = text.normalize("NFKD");
    if (text !== normalizedText) { 
        return true
    }
    const blockedWords = JSON.parse(fs.readFileSync("blockedword.json"));

    const lowerText = text.toLowerCase();

    return blockedWords.some(word => lowerText.includes(word.toLowerCase()));
}

// Delete comments
async function deleteComments(auth, commentIds) {
    const youtube = google.youtube({ version: "v3", auth });

    const totalCommentsToBeDeleted = commentIds.length;
    let totalDeletedComments = 0;
    do{
        const commentIdsChunk = commentIds.splice(0,50);
        if (commentIdsChunk.length === 0) break;
        try {
            await youtube.comments.setModerationStatus({
                id: commentIdsChunk,
                moderationStatus: "rejected"
            });
            totalDeletedComments += commentIdsChunk.length;
            console.log(`Progress: ${totalDeletedComments}/${totalCommentsToBeDeleted} (${commentIds.length} remaining)
Deleted the following comment IDs:`, commentIdsChunk);
        } catch (error) {
            console.error(`Failed to delete these comment IDs: ${commentIdsChunk}:`, error.message);
        }
    } while (commentIds.length > 0);
}

async function youtubeContentList(auth) {
    const youtube = google.youtube({ version: "v3", auth });

    try {
    const response = await youtube.channels.list({
        part: "contentDetails",
        id: youtubeChannelID, // ← use forUsername if you're passing a name
    });

    const channel = response.data.items[0];
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    const allVideos = [];
    let nextPageToken = "";

    do {
        const playlistResponse = await youtube.playlistItems.list({
            part: "snippet",
            playlistId: uploadsPlaylistId,
            maxResults: 50,
            pageToken: nextPageToken,
        });

        allVideos.push(...playlistResponse.data.items);
        nextPageToken = playlistResponse.data.nextPageToken;
    } while (nextPageToken);
        return allVideos;
    } catch (error) {
        console.error("Error fetching videos:", error);
        return [];
    }
}

(async () => {
    try {
        const auth = await authorize();
        const contentList = await youtubeContentList(auth);

    for (const video of contentList) {
        const title = video.snippet.title;
        const videoId = video.snippet.resourceId.videoId;
        console.log(`\n📹 Checking video: ${title} (ID: ${videoId})`);
        const spamComments = await fetchComments(auth, videoId);

        if (spamComments.length > 0) {
            console.log(`🚫 Found ${spamComments.length} spam comments. Deleting...`);
            await deleteComments(auth, spamComments);
            console.log("✅ Spam comments deleted.");
        } else {
            console.log("✅ No spam comments found.");
        }
    }
    
        
    } catch (error) {
        console.error("Error running script:", error);
    }
})();
