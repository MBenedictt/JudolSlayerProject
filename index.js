import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline";
import { google } from "googleapis";
import http from "node:http";
import url from "node:url";

// Load client secrets from credentials.json
const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];
const TOKEN_PATH = "token.json";
const youtubeVideoID = process.env.VIDEO_ID; // Replace with your video ID

// Validasi VIDEO_ID
if (!youtubeVideoID) {
    console.error("ERROR: VIDEO_ID tidak ditemukan di file .env");
    console.log("Pastikan Anda telah menambahkan VIDEO_ID=<id_video_youtube> di file .env");
    process.exit(1);
}

// Validasi format VIDEO_ID
const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
if (!videoIdRegex.test(youtubeVideoID)) {
    console.error("ERROR: Format VIDEO_ID tidak valid");
    console.log("ID video YouTube harus berupa string dengan panjang 11 karakter");
    console.log("Contoh: VIDEO_ID=dQw4w9WgXcQ");
    process.exit(1);
}

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

        // Buat server HTTP lokal untuk menerima callback
        const server = http.createServer(async (req, res) => {
            try {
                const parsedUrl = url.parse(req.url, true);
                const code = parsedUrl.query.code;
                
                if (code) {
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(`
                        <html>
                        <body style="text-align: center; font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Autentikasi Berhasil!</h2>
                            <p>Token berhasil didapatkan. Anda dapat menutup halaman ini.</p>
                        </body>
                        </html>
                    `);
                    
                    server.close();
                    
                    oAuth2Client.getToken(code, (err, token) => {
                        if (err) {
                            console.error("Gagal mengambil token akses", err);
                            reject(err);
                            return;
                        }
                        oAuth2Client.setCredentials(token);
                        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                        console.log("Token disimpan ke", TOKEN_PATH);
                        resolve(oAuth2Client);
                    });
                }
            } catch (error) {
                console.error("Error parsing callback:", error);
                res.writeHead(500, { "Content-Type": "text/html" });
                res.end("Terjadi kesalahan");
            }
        });
        
        server.listen(80, () => {
            console.log("Server berjalan di http://localhost:80");
            console.log("Izinkan aplikasi ini dengan mengunjungi URL ini:", authUrl);
            console.log("Silahkan buka URL di atas pada browser Anda");
        });
    });
}

// Fetch comments
async function fetchComments(auth) {
    const youtube = google.youtube({ version: "v3", auth });

    try {
        // Validasi kepemilikan video
        try {
            await validateVideoOwnership(youtube, youtubeVideoID);
        } catch (ownershipError) {
            console.error(`PERINGATAN: ${ownershipError.message}`);
            console.log("Pastikan Anda login dengan akun yang memiliki video tersebut.");
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            
            return new Promise((resolve, reject) => {
                rl.question("Apakah Anda tetap ingin melanjutkan? (y/n): ", (answer) => {
                    rl.close();
                    if (answer.toLowerCase() !== 'y') {
                        console.log("Program dihentikan.");
                        process.exit(0);
                    }
                    resolve(continueWithComments(youtube));
                });
            });
        }
        
        return continueWithComments(youtube);
    } catch (error) {
        console.error("Gagal mengambil komen:", error);
        return [];
    }
}

// Validasi kepemilikan video
async function validateVideoOwnership(youtube, videoId) {
    // Dapatkan info channel yang terautentikasi
    const myChannelResponse = await youtube.channels.list({
        part: "id",
        mine: true
    });
    
    if (!myChannelResponse.data.items || myChannelResponse.data.items.length === 0) {
        throw new Error("Tidak dapat menemukan channel yang terautentikasi");
    }
    
    const myChannelId = myChannelResponse.data.items[0].id;
    
    // Dapatkan info video
    const videoResponse = await youtube.videos.list({
        part: "snippet",
        id: videoId
    });
    
    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
        throw new Error(`Video dengan ID ${videoId} tidak ditemukan`);
    }
    
    const videoChannelId = videoResponse.data.items[0].snippet.channelId;
    
    // Bandingkan ID channel
    if (myChannelId !== videoChannelId) {
        throw new Error(`Video ini bukan milik channel Anda. Video milik channel: ${videoResponse.data.items[0].snippet.channelTitle}`);
    }
    
    console.log(`Validasi berhasil: Video dimiliki oleh channel Anda (${videoResponse.data.items[0].snippet.channelTitle})`);
}

// Lanjutkan dengan pengambilan komen
async function continueWithComments(youtube) {
    const response = await youtube.commentThreads.list({
        part: "snippet",
        videoId: youtubeVideoID,
        maxResults: 100,
    });

    const spamComments = [];

    for (const item of response.data.items) {
        const comment = item.snippet.topLevelComment.snippet;
        const commentText = comment.textDisplay;
        const commentId = item.snippet.topLevelComment.id;
        const authorName = comment.authorDisplayName;

        console.log(`Memeriksa komen dari ${authorName}: "${commentText}"`);

        if (getJudolComment(commentText)) {
            console.log(`🚨 Komen spam ditemukan dari ${authorName}: "${commentText}"`);
            spamComments.push(commentId);
        }
    }

    return spamComments;
}

function getJudolComment(text) {
    const normalizedText = text.normalize("NFKD");
    return text !== normalizedText; // Jika berbeda, komen asli memiliki karakter Unicode yang aneh
}

// Delete comments
async function deleteComments(auth, commentIds) {
    const youtube = google.youtube({ version: "v3", auth });

    for (const commentId of commentIds) {
        try {
            console.log(`Mencoba menghapus komen dengan ID: ${commentId}`);
            
            // Periksa apakah ID adalah comment thread atau comment ID
            const isCommentThread = commentId.startsWith("Ug") && !commentId.includes(".");
            
            if (isCommentThread) {
                // Jika ini adalah comment thread, kita perlu mendapatkan comment ID sebenarnya
                const response = youtube.commentThreads.list({
                    part: "snippet",
                    id: commentId
                });
                
                if (response.data.items && response.data.items.length > 0) {
                    const actualCommentId = response.data.items[0].snippet.topLevelComment.id;
                    console.log(`Comment thread ID ${commentId} merujuk ke comment ID: ${actualCommentId}`);
                    
                    // Hapus menggunakan ID yang sebenarnya
                    await youtube.comments.delete({ id: actualCommentId });
                    console.log(`Terhapus komen: ${actualCommentId} (dari thread ${commentId})`);
                } else {
                    throw new Error("Comment thread tidak ditemukan");
                }
            } else {
                // Jika ini adalah comment ID biasa
                await youtube.comments.delete({ id: commentId });
                console.log(`Terhapus komen: ${commentId}`);
            }
        } catch (error) {
            console.error(`Gagal menghapus komen ${commentId}:`, error.message);
            
            // Tampilkan detail error tambahan jika ada
            if (error.response) {
                console.error(`Error status: ${error.response.status}`);
                console.error(`Error detail: ${JSON.stringify(error.response.data)}`);
            }
            
            console.log("\nKemungkinan penyebab error:");
            console.log("1. ID komen tidak valid atau sudah dihapus");
            console.log("2. Anda tidak memiliki izin untuk menghapus komen ini");
            console.log("3. Anda menggunakan commentThread ID bukan comment ID");
            console.log("4. Rate limit API YouTube terlampaui\n");
        }
    }
}

(async () => {
    try {
        const auth = await authorize();
        const spamComments = await fetchComments(auth);

        if (spamComments.length > 0) {
            console.log(`Ditemukan ${spamComments.length} komen spam. Menghapus...`);
            await deleteComments(auth, spamComments);
        } else {
            console.log("Tidak ada komen spam yang ditemukan.");
        }
    } catch (error) {
        console.error("Gagal menjalankan program:", error);
    }
})();
