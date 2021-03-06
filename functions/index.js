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
const {
	signUp,
	login,
	uploadImage,
	updateUserDetails,
	getUserDetails,
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

// Auth routes
app.post("/signup", signUp)
app.post("/login", login)
app.post("/user/upload-image", verifyToken, uploadImage)
app.post("/user/update-details", verifyToken, updateUserDetails)
app.get("/user/get-details", verifyToken, getUserDetails)

exports.api = functions.region("europe-west1").https.onRequest(app)

// Create a notification when a user likes a tweet
exports.createNotificationOnLike = functions
	.region("europe-west1")
	.firestore.document("likes/{id}")
	.onCreate(newLikeDocumentSnapshot => {
		db.doc(`/tweets/${newLikeDocumentSnapshot.data().tweetId}`)
			.get()
			.then(doc => {
				if (doc.exists) {
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
			.then(() => {
				return
			})
			.catch(err => {
				console.error(err)
				return
			})
	})

// Create a notification when a user comments on a tweet
exports.createNotificationOnComment = functions
	.region("europe-west1")
	.firestore.document("comments/{id}")
	.onCreate(newCommentDocumentSnapshot => {
		db.doc(`/tweets/${newCommentDocumentSnapshot.data().tweetId}`)
			.get()
			.then(doc => {
				if (doc.exists) {
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
			.then(() => {
				return
			})
			.catch(err => {
				console.error(err)
				return
			})
	})
