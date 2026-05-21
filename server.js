const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"]
});

app.use(express.static("public"));

let waitingUsers = [];
const cooldown = new Map();
const COOLDOWN_TIME = 4000;

// ---------------- AI MATCH ----------------
function smartMatch(socket){

    const now = Date.now();

    if(cooldown.has(socket.id)){
        if(now - cooldown.get(socket.id) < COOLDOWN_TIME){
            socket.emit("cooldown",{msg:"Wait before searching again"});
            return false;
        }
    }

    cooldown.set(socket.id, now);

    let bestIndex = -1;
    let bestScore = -1;

    for(let i=0;i<waitingUsers.length;i++){

        const user = waitingUsers[i];
        if(user.id === socket.id) continue;

        let score = 0;

        // country boost
        if(user.country && user.country === socket.country){
            score += 10;
        }

        // random AI factor
        score += Math.random() * 5;

        if(score > bestScore){
            bestScore = score;
            bestIndex = i;
        }
    }

    if(bestIndex !== -1){

        const partner = waitingUsers.splice(bestIndex,1)[0];

        const roomId = "room-" + partner.id + "-" + socket.id;

        socket.join(roomId);
        partner.join(roomId);

        partner.emit("matched",{
            roomId,
            isCaller:true,
            partnerCountry: socket.country || "unknown"
        });

        socket.emit("matched",{
            roomId,
            isCaller:false,
            partnerCountry: partner.country || "unknown"
        });

        return true;
    }

    return false;
}

// ---------------- MAIN ----------------
io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    socket.on("setCountry",(country)=>{
        socket.country = country || "unknown";
    });

    socket.on("findMatch",()=>{

        const matched = smartMatch(socket);

        if(!matched){
            waitingUsers.push(socket);
            socket.emit("waiting");
        }
    });

    // CHAT
    socket.on("message",(data)=>{
        socket.to(data.roomId).emit("message",{
            text:data.text,
            from:socket.id
        });
    });

    // VOICE (WebRTC audio only)
    socket.on("offer", d => socket.to(d.roomId).emit("offer", d.offer));
    socket.on("answer", d => socket.to(d.roomId).emit("answer", d.answer));
    socket.on("ice-candidate", d => socket.to(d.roomId).emit("ice-candidate", d.candidate));

    // MUTE SYNC
    socket.on("mute-state",(data)=>{
        socket.to(data.roomId).emit("partner-mute",data.isMuted);
    });

    // NEXT
    socket.on("next",()=>{

        socket.rooms.forEach(room=>{
            if(room !== socket.id){
                socket.leave(room);
                socket.to(room).emit("partner-left");
            }
        });

        socket.emit("waiting");
    });

    // DISCONNECT
    socket.on("disconnect",()=>{
        waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT,()=>{
    console.log("Velora v5 (NO VIDEO) running");
});
