const functions = require("firebase-functions")

const express = require("express")
const app = express()

// Handlers
const {
	getAllTweets,
	createTweet,
	getTweet,
	commentOnTweet,
	likeTweet,
	unlikeTweet,
	deleteTweet,
} = require("./handlers/tweets")

const { markAsRead } = require("./handlers/notifications")

const {
	signUp,
	login,
	uploadImage,
	updateUserDetails,
	getUserDetails,
	getAuthenticatedUserDetails,
} = require("./handlers/auth")

const { db } = require("./util/admin")

// Middlewares
const verifyToken = require("./middlewares/verifyToken")

// Tweet Routes
app.get("/tweets", getAllTweets)
app.post("/create-tweet", verifyToken, createTweet)
app.get("/tweet/:id", getTweet)
app.post("/tweet/:id/comment", verifyToken, commentOnTweet)
app.post("/tweet/:id/like", verifyToken, likeTweet)
app.post("/tweet/:id/unlike", verifyToken, unlikeTweet)
app.delete("/tweet/:id", verifyToken, deleteTweet)

// Notification routes
app.delete("/notifications/mark-as-read", verifyToken, markAsRead)

// User routes
app.post("/signup", signUp)
app.post("/login", login)
app.post("/user/upload-image", verifyToken, uploadImage)
app.post("/user/update-details", verifyToken, updateUserDetails)
app.get("/user/get-details", verifyToken, getAuthenticatedUserDetails)
app.get("/user/:handle", getUserDetails)

exports.api = functions.region("europe-west1").https.onRequest(app)

// Database Triggers
// Create a notification when a user likes a tweet
exports.createNotificationOnLike = functions
	.region("europe-west1")
	.firestore.document("likes/{id}")
	.onCreate(newLikeDocumentSnapshot => {
		// console.log("newLikeDocumentSnapshot", newLikeDocumentSnapshot)
		return db
			.doc(`/tweets/${newLikeDocumentSnapshot.data().tweetId}`)
			.get()
			.then(doc => {
				if (
					doc.exists &&
					newLikeDocumentSnapshot.data().userHandle !==
						doc.data().userHandle
				) {
					return db
						.doc(`/notifications/${newLikeDocumentSnapshot.id}`)
						.set({
							sender: newLikeDocumentSnapshot.data().userHandle,
							recipient: doc.data().userHandle,
							read: false,
							type: "like",
							tweetId: doc.id,
							createdAt: new Date().toISOString(),
						})
				}
			})
			.catch(err => {
				console.error(err)
			})
	})

// Delete a notification when a user unlikes a tweet
exports.deleteNotificationOnUnlike = functions
	.region("europe-west1")
	.firestore.document("likes/{id}")
	.onDelete(unlikeDocumentSnapshot => {
		return db
			.doc(`/notifications/${unlikeDocumentSnapshot.id}`)
			.delete()
			.catch(err => {
				console.error(err)
			})
	})

// Create a notification when a user comments on a tweet
exports.createNotificationOnComment = functions
	.region("europe-west1")
	.firestore.document("comments/{id}")
	.onCreate(newCommentDocumentSnapshot => {
		return db
			.doc(`/tweets/${newCommentDocumentSnapshot.data().tweetId}`)
			.get()
			.then(doc => {
				if (
					doc.exists &&
					newCommentDocumentSnapshot.data().userHandle !==
						doc.data().userHandle
				) {
					return db
						.doc(`/notifications/${newCommentDocumentSnapshot.id}`)
						.set({
							sender: newCommentDocumentSnapshot.data().userHandle,
							recipient: doc.data().userHandle,
							read: false,
							type: "comment",
							tweetId: doc.id,
							createdAt: new Date().toISOString(),
						})
				}
			})
			.catch(err => {
				console.error(err)
			})
	})

// Update image url in tweets whenever a user changes his/her profile image
exports.onProfilePictureChange = functions
	.region("europe-west1")
	.firestore.document("users/{id}")
	.onUpdate(({ before, after }) => {
		// Check if image has actually changed
		if (before.data().imageUrl !== after.data().imageUrl) {
			const batch = db.batch()
			return db
				.collection("tweets")
				.where("userHandle", "==", before.data().handle)
				.get()
				.then(docs => {
					docs.forEach(doc => {
						const tweet = db.doc(`/tweets/${doc.id}`)
						batch.update(tweet, { userImage: after.data().imageUrl })
					})

					return batch.commit()
				})
				.catch(err => {
					console.error(err)
				})
		}
	})

// Delete notifications, likes and comments whenever a user deletes a tweet
exports.onTweetDelete = functions
	.region("europe-west1")
	.firestore.document("tweets")
