const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

module.exports = (postsCollection) => {
    
    // Get all posts
    router.get('/', async (req, res) => {
        try {
            const { userId } = req.query;
            
            const posts = await postsCollection
                .find({})
                .sort({ createdAt: -1 })
                .toArray();
            
            // Format posts for frontend
            const formattedPosts = posts.map(post => ({
                _id: post._id,
                user: {
                    name: post.userName,
                    title: post.userTitle || 'Professional',
                    avatar: post.userAvatar
                },
                content: post.content,
                image: post.image, // Single image (backward compatibility)
                images: post.images || (post.image ? [post.image] : []), // Support both single image and multiple images
                timestamp: formatTimestamp(post.createdAt || post.timestamp),
                likes: post.likes || 0,
                comments: post.comments ? post.comments.length : 0,
                shares: post.shares || 0,
                isLiked: post.likedBy && userId ? post.likedBy.includes(userId) : false,
                isSaved: post.savedBy && userId ? post.savedBy.includes(userId) : false
            }));
            
            res.json(formattedPosts);
        } catch (error) {
            console.error('Error fetching posts:', error);
            res.status(500).json({ error: 'Failed to fetch posts' });
        }
    });

    // Create new post
    router.post('/', async (req, res) => {
        try {
            const { content, image, images, userId, userEmail, userName, userAvatar } = req.body;
            
            // Support both single image and multiple images
            const postImages = images || (image ? [image] : []);
            
            const newPost = {
                content,
                image: postImages[0] || null, // Backward compatibility
                images: postImages, // New field for multiple images
                userId: new ObjectId(userId),
                userEmail,
                userName,
                userAvatar,
                likes: 0,
                shares: 0,
                likedBy: [],
                savedBy: [],
                comments: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await postsCollection.insertOne(newPost);
            
            // Return the created post with formatted response
            const createdPost = {
                _id: result.insertedId,
                user: {
                    name: userName,
                    title: 'Professional',
                    avatar: userAvatar
                },
                content,
                image: postImages[0] || null,
                images: postImages,
                timestamp: 'Just now',
                likes: 0,
                comments: 0,
                shares: 0,
                isLiked: false,
                isSaved: false
            };
            
            res.status(201).json(createdPost);
        } catch (error) {
            console.error('Error creating post:', error);
            res.status(500).json({ error: 'Failed to create post' });
        }
    });

    // Like a post
    router.post('/:postId/like', async (req, res) => {
        try {
            const { postId } = req.params;
            const { userId } = req.body;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            
            const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
            
            if (!post) {
                return res.status(404).json({ error: 'Post not found' });
            }
            
            const isLiked = post.likedBy && post.likedBy.includes(userId);
            
            if (isLiked) {
                // Unlike
                await postsCollection.updateOne(
                    { _id: new ObjectId(postId) },
                    { 
                        $inc: { likes: -1 },
                        $pull: { likedBy: userId }
                    }
                );
            } else {
                // Like
                await postsCollection.updateOne(
                    { _id: new ObjectId(postId) },
                    { 
                        $inc: { likes: 1 },
                        $push: { likedBy: userId }
                    }
                );
            }
            
            res.json({ success: true, isLiked: !isLiked });
        } catch (error) {
            console.error('Error liking post:', error);
            res.status(500).json({ error: 'Failed to like post' });
        }
    });

    // Save a post
    router.post('/:postId/save', async (req, res) => {
        try {
            const { postId } = req.params;
            const { userId } = req.body;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            
            const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
            
            if (!post) {
                return res.status(404).json({ error: 'Post not found' });
            }
            
            const isSaved = post.savedBy && post.savedBy.includes(userId);
            
            if (isSaved) {
                // Unsave
                await postsCollection.updateOne(
                    { _id: new ObjectId(postId) },
                    { $pull: { savedBy: userId } }
                );
            } else {
                // Save
                await postsCollection.updateOne(
                    { _id: new ObjectId(postId) },
                    { $push: { savedBy: userId } }
                );
            }
            
            res.json({ success: true, isSaved: !isSaved });
        } catch (error) {
            console.error('Error saving post:', error);
            res.status(500).json({ error: 'Failed to save post' });
        }
    });

    // Helper function to format timestamp
    function formatTimestamp(date) {
        if (!date) return 'Just now';
        
        const now = new Date();
        const postDate = new Date(date);
        const diffInSeconds = Math.floor((now - postDate) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return postDate.toLocaleDateString();
    }

    return router;
};