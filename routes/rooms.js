const express = require("express");
const { ObjectId } = require("mongodb");

function createRoomsRouter(db, verifyToken) {
    const router = express.Router();
    const roomsCollection = db.collection("rooms");

    router.get("/", async (req, res) => {
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
            res.status(500).send({ message: "Failed to fetch rooms catalog index matrix." });
        }
    });

    router.get("/home-rooms", async (req, res) => {
        try {
            const result = await roomsCollection
                .find()
                .sort({ _id: -1 })
                .limit(6)
                .toArray();
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to fetch featured rooms catalog matrix." });
        }
    });

    router.get("/featured-rooms", async (req, res) => {
        try {
            const result = await roomsCollection
                .find()
                .sort({ _id: -1 })
                .limit(6)
                .toArray();
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to fetch featured rooms." });
        }
    });

    router.get("/:id", async (req, res) => {
        try {
            const id = req.params.id;
            const result = await roomsCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to fetch specific room parameters." });
        }
    });

    router.post("/", verifyToken, async (req, res) => {
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
            res.status(500).send({ message: "Failed to store room listing asset metadata." });
        }
    });

    return router;
}

module.exports = createRoomsRouter;
