const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error("Missing environment variables");
}

app.use(
    cors({
        origin: ["http://localhost:5173"],
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized access" });
        }

        req.user = decoded;
        next();
    });
};

async function run() {
    try {
        await client.connect();
        console.log("Successfully connected to the MongoDB Cluster Engine.");

        const db = client.db("studyNookDB");
        const roomsCollection = db.collection("rooms");
        const bookingsCollection = db.collection("bookings");

        app.post("/api/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(
                { email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            }).send({ success: true });
        });

        app.post("/api/logout", (req, res) => {
            res.clearCookie("token", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            }).send({ success: true });
        });

        app.get("/api/rooms", async (req, res) => {
            try {
                const search = req.query.search || "";
                const amenities = req.query.amenities;
                let query = {};

                if (search) {
                    query.name = { $regex: search, $options: "i" };
                }

                if (amenities) {
                    query.amenities = { $all: amenities.split(",") };
                }

                const result = await roomsCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch rooms" });
            }
        });

        app.get("/api/home-rooms", async (req, res) => {
            try {
                const result = await roomsCollection
                    .find()
                    .sort({ _id: -1 })
                    .limit(6)
                    .toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch featured rooms" });
            }
        });

        app.get("/api/rooms/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const result = await roomsCollection.findOne({
                    _id: new ObjectId(id),
                });
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch room parameters" });
            }
        });

        app.post("/api/rooms", verifyToken, async (req, res) => {
            try {
                const roomPayload = {
                    name: req.body.name,
                    description: req.body.description,
                    image: req.body.image,
                    floor: req.body.floor,
                    capacity: parseInt(req.body.capacity),
                    hourlyRate: parseFloat(req.body.hourlyRate),
                    amenities: req.body.amenities || [],
                    ownerEmail: req.user.email,
                    ownerName: req.body.ownerName,
                    bookingCount: 0,
                    createdAt: new Date(),
                };

                const result = await roomsCollection.insertOne(roomPayload);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to add room" });
            }
        });

        app.post("/api/bookings", verifyToken, async (req, res) => {
            try {
                const booking = req.body;
                const conflict = await bookingsCollection.findOne({
                    roomId: booking.roomId,
                    date: booking.date,
                    status: "confirmed",
                    $or: [
                        {
                            startTime: { $lt: booking.endTime },
                            endTime: { $gt: booking.startTime },
                        },
                    ],
                });

                if (conflict) {
                    return res
                        .status(400)
                        .send({ message: "Time slot already booked" });
                }

                const result = await bookingsCollection.insertOne({
                    ...booking,
                    status: "confirmed",
                    createdAt: new Date(),
                });

                await roomsCollection.updateOne(
                    { _id: new ObjectId(booking.roomId) },
                    { $inc: { bookingCount: 1 } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Booking failed" });
            }
        });

        app.get("/api/bookings", verifyToken, async (req, res) => {
            try {
                const result = await bookingsCollection
                    .find({ userEmail: req.user.email })
                    .toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch bookings" });
            }
        });

        app.patch("/api/bookings/:id/cancel", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id), userEmail: req.user.email },
                    { $set: { status: "cancelled" } }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Cancel failed" });
            }
        });

    } catch (error) {
        console.error("Database initialization failed:", error);
    }
}

run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("StudyNook Server Running");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
