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

// helper
function clearWaiting(socket){
    if(waitingUser && waitingUser.id === socket.id){
        waitingUser = null;
    }
}

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    socket.on("setName", (name) => {
        socket.username = name || "User";
    });

    // MATCH SYSTEM
    socket.on("findMatch", () => {

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

    // SIGNALING
    socket.on("offer", d => socket.to(d.roomId).emit("offer", d.offer));
    socket.on("answer", d => socket.to(d.roomId).emit("answer", d.answer));
    socket.on("ice-candidate", d => socket.to(d.roomId).emit("ice-candidate", d.candidate));

    // MUTE SYNC
    socket.on("mute-state", d => {
        socket.to(d.roomId).emit("partner-mute-state", {
            isMuted: d.isMuted
        });
    });

    // NEXT USER
    socket.on("next", () => {

        socket.rooms.forEach(room => {
            if(room !== socket.id){
                socket.leave(room);
                socket.to(room).emit("partner-disconnected");
            }
        });

        clearWaiting(socket);
        socket.emit("waiting");
    });

    socket.on("disconnect", () => {
        clearWaiting(socket);
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Velora v4 running on port", PORT);
});
