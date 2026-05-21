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

let waitingUser = null;
const cooldown = new Map(); // anti spam match

function clearWaiting(socket){
    if(waitingUser && waitingUser.id === socket.id){
        waitingUser = null;
    }
}

function inCooldown(id){
    return cooldown.get(id) && Date.now() < cooldown.get(id);
}

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    socket.on("setName", (name) => {
        socket.username = name || "User";
    });

    // MATCH SYSTEM (ANTI SPAM)
    socket.on("findMatch", () => {

        if(inCooldown(socket.id)){
            socket.emit("cooldown");
            return;
        }

        if(waitingUser && waitingUser.id !== socket.id){

            const roomId = "room-" + waitingUser.id + "-" + socket.id;

            socket.join(roomId);
            waitingUser.join(roomId);

            waitingUser.emit("matched", {
                roomId,
                isCaller: true,
                partnerName: socket.username || "User"
            });

            socket.emit("matched", {
                roomId,
                isCaller: false,
                partnerName: waitingUser.username || "User"
            });

            waitingUser = null;

        } else {
            waitingUser = socket;
            socket.emit("waiting");
        }
    });

    // WEBRTC AUDIO ONLY
    socket.on("offer", d => socket.to(d.roomId).emit("offer", d.offer));
    socket.on("answer", d => socket.to(d.roomId).emit("answer", d.answer));
    socket.on("ice-candidate", d => socket.to(d.roomId).emit("ice-candidate", d.candidate));

    // MUTE SYNC
    socket.on("mute-state", d => {
        socket.to(d.roomId).emit("partner-mute-state", {
            isMuted: d.isMuted
        });
    });

    // NEXT USER + COOLDOWN
    socket.on("next", () => {

        socket.rooms.forEach(room => {
            if(room !== socket.id){
                socket.leave(room);
                socket.to(room).emit("partner-disconnected");
            }
        });

        clearWaiting(socket);

        // anti spam cooldown 2 sec
        cooldown.set(socket.id, Date.now() + 2000);

        socket.emit("waiting");
    });

    socket.on("disconnect", () => {
        clearWaiting(socket);
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Velora v5 running on port", PORT);
});
