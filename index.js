require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

// Load client secrets from credentials.json
const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];
const TOKEN_PATH = "token.json";
const youtubeVideoID = process.env.YOUTUBE_VIDEO_ID; // Replace with your video ID

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
async function fetchComments(auth) {
    const youtube = google.youtube({ version: "v3", auth });
    const VIDEO_ID = youtubeVideoID;

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
    return text !== normalizedText;
}

// Delete comments
async function deleteComments(auth, commentIds) {
    const youtube = google.youtube({ version: "v3", auth });

    for (const commentId of commentIds) {
        try {
            await youtube.comments.delete({ id: commentId });
            console.log(`Deleted comment: ${commentId}`);
        } catch (error) {
            console.error(`Failed to delete comment ${commentId}:`, error.message);
        }
    }
}

(async () => {
    try {
        const auth = await authorize();
        const spamComments = await fetchComments(auth);

        if (spamComments.length > 0) {
            console.log(`Found ${spamComments.length} spam comments. Deleting...`);
            await deleteComments(auth, spamComments);
        } else {
            console.log("No spam comments found.");
        }
    } catch (error) {
        console.error("Error running script:", error);
    }
})();
