const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static("public"));

let waitingUser = null;

// 🧠 clean waiting user
function clearWaiting(socket){
    if(waitingUser && waitingUser.id === socket.id){
        waitingUser = null;
    }
}

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    // 🎯 MATCH
    socket.on("findMatch", () => {

        if (waitingUser && waitingUser.id !== socket.id) {

            const roomId = room-${waitingUser.id}-${socket.id};

            socket.join(roomId);
            waitingUser.join(roomId);

            waitingUser.emit("matched", {
                roomId,
                isCaller: true
            });

            socket.emit("matched", {
                roomId,
                isCaller: false
            });

            waitingUser = null;

        } else {
            waitingUser = socket;
            socket.emit("waiting");
        }
    });

    // 🎧 WEBRTC SIGNALING
    socket.on("offer", (data) => {
        socket.to(data.roomId).emit("offer", data.offer);
    });

    socket.on("answer", (data) => {
        socket.to(data.roomId).emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {
        socket.to(data.roomId).emit("ice-candidate", data.candidate);
    });

    // 🔇 MUTE SYNC
    socket.on("mute-state", (data) => {
        socket.to(data.roomId).emit("partner-mute-state", {
            isMuted: data.isMuted
        });
    });

    // ⏭ NEXT USER
    socket.on("next", () => {

        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
                socket.to(room).emit("partner-disconnected");
            }
        });

        clearWaiting(socket);

        socket.emit("waiting");
    });

    // ❌ DISCONNECT CLEANUP
    socket.on("disconnect", () => {
        clearWaiting(socket);
        console.log("Disconnected:", socket.id);
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Velora running on port", PORT);
});
