const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.static("public"));

let waitingUser = null;

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    // 🎯 FIND MATCH
    socket.on("findMatch", () => {

        // إذا يوجد شخص ينتظر
        if (waitingUser && waitingUser.id !== socket.id) {

            const roomId = room-${waitingUser.id}-${socket.id};

            socket.join(roomId);
            waitingUser.join(roomId);

            // إرسال للطرف الأول
            waitingUser.emit("matched", {
                roomId,
                isCaller: true
            });

            // إرسال للطرف الثاني
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

    // 🎧 WebRTC SIGNALING
    socket.on("offer", (data) => {
        socket.to(data.roomId).emit("offer", data.offer);
    });

    socket.on("answer", (data) => {
        socket.to(data.roomId).emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {
        socket.to(data.roomId).emit("ice-candidate", data.candidate);
    });

    // 🔇 MUTE SYNC (optional feature)
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

        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
        }

        socket.emit("waiting");
    });

    // ❌ DISCONNECT CLEANUP
    socket.on("disconnect", () => {

        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
        }
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Velora running on port ${PORT}`);
});
