const { ObjectId } = require('mongodb');

module.exports = (usersCollection) => {
    const express = require('express');
    const router = express.Router();

    // Check if usersCollection is available
    router.use((req, res, next) => {
        if (!usersCollection) {
            return res.status(503).json({
                success: false,
                message: 'Database not initialized. Please try again later.'
            });
        }
        next();
    });

    // Create or update user
    router.post('/', async (req, res) => {
        try {
            const userData = req.body;

            // Validate required fields
            if (!userData.uid || !userData.email) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and email are required'
                });
            }

            // Check if user already exists
            const existingUser = await usersCollection.findOne({ uid: userData.uid });

            if (existingUser) {
                // Update existing user
                const result = await usersCollection.updateOne(
                    { uid: userData.uid },
                    {
                        $set: {
                            ...userData,
                            updatedAt: new Date()
                        }
                    }
                );

                const updatedUser = await usersCollection.findOne({ uid: userData.uid });

                return res.json({
                    success: true,
                    message: 'User updated successfully',
                    user: updatedUser
                });
            } else {
                // Create new user with default package
                const newUser = {
                    ...userData,
                    package: 'basic', // Default package
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await usersCollection.insertOne(newUser);

                return res.json({
                    success: true,
                    message: 'User created successfully',
                    user: { ...newUser, _id: result.insertedId }
                });
            }
        } catch (error) {
            console.error('Error creating/updating user:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    });

    // Get user by UID
    router.get('/:uid', async (req, res) => {
        try {
            const { uid } = req.params;

            const user = await usersCollection.findOne({ uid });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    });

    // Get all users (for admin purposes)
    router.get('/', async (req, res) => {
        try {
            const users = await usersCollection.find({}).toArray();

            res.json({
                success: true,
                users,
                count: users.length
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    });

    // Update user profile
    router.put('/:uid', async (req, res) => {
        try {
            const { uid } = req.params;
            const updateData = req.body;

            const result = await usersCollection.updateOne(
                { uid },
                {
                    $set: {
                        ...updateData,
                        updatedAt: new Date()
                    }
                }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const updatedUser = await usersCollection.findOne({ uid });

            res.json({
                success: true,
                message: 'User updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    });

    // Delete user
    router.delete('/:uid', async (req, res) => {
        try {
            const { uid } = req.params;

            const result = await usersCollection.deleteOne({ uid });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    });

    // In your backend user routes (routes/users.js)
    router.put('/:uid', async (req, res) => {
        try {
            const { uid } = req.params;
            const updateData = req.body;

            const result = await usersCollection.updateOne(
                { uid },
                {
                    $set: {
                        ...updateData,
                        updatedAt: new Date()
                    }
                }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const updatedUser = await usersCollection.findOne({ uid });

            res.json({
                success: true,
                message: 'User updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    });

    return router;
};