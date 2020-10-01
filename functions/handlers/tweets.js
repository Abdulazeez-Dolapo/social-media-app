const { db } = require("../util/admin")

const { validateTweetData } = require("../util/validators")

exports.createTweet = (req, res) => {
	// if (req.method !== "POST") {
	// 	return res.status(400).json({
	// 		success: false,
	// 		message: "Method not allowed on this endpoint",
	// 	})
	// }
	const newTweetData = {
		body: req.body.body,
	}

	const { valid, errors } = validateTweetData(newTweetData)
	if (!valid) {
		return res.status(400).json({
			success: false,
			error: errors,
		})
	}

	const newTweet = {
		userHandle: req.user.handle,
		userImage: req.user.imageUrl,
		body: req.body.body,
		createdAt: new Date().toISOString(),
		likesCount: 0,
		commentsCount: 0,
		// createdAt: admin.firestore.Timestamp.fromDate(new Date()),
	}

	db.collection("tweets")
		.add(newTweet)
		.then(doc => {
			newTweet.id = doc.id
			res.json({
				success: true,
				message: "Tweet created successfully",
				tweet: newTweet,
			})
		})
		.catch(err => {
			res.status(500).json({
				success: false,
				error: err.message,
			})
			console.error(err)
		})
}

exports.getAllTweets = (req, res) => {
	db.collection("tweets")
		.orderBy("createdAt", "desc")
		.get()
		.then(data => {
			let tweets = []
			data.forEach(doc => {
				tweets.push({
					id: doc.id,
					...doc.data(),
				})
			})
			return res.json({
				success: true,
				message: "Tweets found",
				tweets,
			})
		})
		.catch(err => console.error(err))
}

exports.getTweet = (req, res) => {
	let tweetData = {}

	// Get tweet data
	db.doc(`/tweets/${req.params.id}`)
		.get()
		.then(doc => {
			if (!doc.exists) {
				return res.status(404).json({
					success: false,
					error: "Tweet could not be found",
				})
			}

			tweetData = doc.data()
			tweetData.id = doc.id

			// Get tweet comments
			return db
				.collection("comments")
				.orderBy("createdAt", "desc")
				.where("tweetId", "==", req.params.id)
				.get()
		})
		.then(data => {
			tweetData.comments = []
			data.forEach(doc => {
				tweetData.comments.push(doc.data())
			})

			return res.json({
				success: true,
				tweetData,
			})
		})
		.catch(err => {
			console.error(err)
			res.status(500).json({
				success: false,
				error: err.message,
			})
		})
}

exports.commentOnTweet = (req, res) => {
	if (req.body.body.trim() == "") {
		return res.status(400).json({
			success: false,
			error: { comment: "Comment must not be empty" },
		})
	}

	let tweetData

	const newComment = {
		body: req.body.body,
		userHandle: req.user.handle,
		userImage: req.user.imageUrl,
		tweetId: req.params.id,
		createdAt: new Date().toISOString(),
	}

	db.doc(`/tweets/${req.params.id}`)
		.get()
		.then(doc => {
			if (!doc.exists) {
				return res.status(404).json({
					success: false,
					error: "Tweet no longer exists",
				})
			}
			// I didn't do the update here because I want the comment to be created first
			// before the comments count is updated in the tweet document

			// This is another way to update
			// doc.ref.update({commentsCount: doc.data().commentsCount + 1})
			tweetData = doc.data()
			tweetData.id = doc.id
			tweetData.commentsCount++
			return db.collection("comments").add(newComment)
		})
		.then(() => {
			// Increment comments count in tweet document
			return db
				.doc(`/tweets/${tweetData.id}`)
				.update({ commentsCount: tweetData.commentsCount })
		})

		.then(() => {
			res.json({
				success: true,
				comment: newComment,
				tweet: tweetData,
			})
		})
		.catch(err => {
			console.error(err)
			res.status(500).json({
				success: false,
				error: err.message,
			})
		})
}

exports.likeTweet = (req, res) => {
	// Query for Like operations
	const likeQuery = db
		.collection(`likes`)
		.where("userHandle", "==", req.user.handle)
		.where("tweetId", "==", req.params.id)
		.limit(1)

	// Query for Tweet operations
	const tweetQuery = db.doc(`/tweets/${req.params.id}`)
	let tweetData

	// Check if tweet exists
	tweetQuery
		.get()
		.then(doc => {
			if (doc.exists) {
				tweetData = doc.data()
				tweetData.id = doc.id
				return likeQuery.get()
			} else {
				return res.status(404).json({
					success: false,
					error: "Tweet does not exist",
				})
			}
		})
		.then(data => {
			// Check if tweet has not already been liked by the user
			if (data.empty) {
				return db
					.collection("likes")
					.add({
						tweetId: req.params.id,
						userHandle: req.user.handle,
					})
					.then(() => {
						tweetData.likesCount++
						return tweetQuery.update({
							likesCount: tweetData.likesCount,
						})
					})
					.then(() => {
						// Create a notification for the owner of the tweet
						return db.collection("notification").add({
							tweetId: req.params.id,
							sender: req.user.handle,
							recipient: tweetData.userHandle,
							read: false,
							type: "like",
							createdAt: new Date().toISOString(),
						})
					})
					.then(hel => {
						return res.json({
							hel,
							success: true,
							message: "You have liked this tweet",
							tweet: tweetData,
						})
					})
			} else {
				return res.status(400).json({
					success: false,
					error: "Tweet already liked by user",
				})
			}
		})
		.catch(err => {
			console.error(err)
			return res.status(500).json({
				success: false,
				error: err.message,
			})
		})
}

exports.unlikeTweet = (req, res) => {
	// Query for Like operations
	const likeQuery = db
		.collection(`likes`)
		.where("userHandle", "==", req.user.handle)
		.where("tweetId", "==", req.params.id)
		.limit(1)

	// Query for Tweet operations
	const tweetQuery = db.doc(`/tweets/${req.params.id}`)
	let tweetData

	// Check if tweet exists
	tweetQuery
		.get()
		.then(doc => {
			if (doc.exists) {
				tweetData = doc.data()
				tweetData.id = doc.id
				return likeQuery.get()
			} else {
				return res.status(404).json({
					success: false,
					error: "Tweet does not exist",
				})
			}
		})
		.then(data => {
			// Check if tweet has already been liked by the user
			if (data.empty) {
				return res.status(400).json({
					success: false,
					error: "Tweet not liked by user",
				})
			} else {
				return db
					.doc(`/likes/${data.docs[0].id}`)
					.delete()
					.then(() => {
						tweetData.likesCount--
						return tweetQuery.update({
							likesCount: tweetData.likesCount,
						})
					})
					.then(() => {
						return res.json({
							success: true,
							message: "You have unliked this tweet",
							tweet: tweetData,
						})
					})
			}
		})
		.catch(err => {
			console.error(err)
			return res.status(500).json({
				success: false,
				error: err.message,
			})
		})
}

exports.deleteTweet = (req, res) => {
	let tweetQuery = db.doc(`/tweets/${req.params.id}`)
	// Check if tweet exists
	tweetQuery
		.get()
		.then(doc => {
			if (!doc.exists) {
				return res.status(404).json({
					success: false,
					error: "Tweet does not exist",
				})
			}

			// Check if current user is creator of this tweet
			if (doc.data().userHandle !== req.user.handle) {
				return res.status(401).json({
					success: false,
					error: "You are not authorized to delete this tweet",
				})
			} else {
				return tweetQuery
					.delete()
					.then(() => {
						// delete comments under a tweet
						return db
							.collection("comments")
							.where("tweetId", "==", req.params.id)
							.get()
					})
					.then(docs => {
						// Once we get the results, begin a batch
						const batch = db.batch()

						docs.forEach(doc => {
							// For each doc, add a delete operation to the batch
							batch.delete(doc.ref)
						})

						// Commit the batch
						return batch.commit()
					})
					.then(() => {
						// delete likes under a tweet
						return db
							.collection(`likes`)
							.where("tweetId", "==", req.params.id)
							.get()
					})
					.then(docs => {
						const batch = db.batch()
						docs.forEach(doc => {
							batch.delete(doc.ref)
						})

						return batch.commit()
					})
					.then(() => {
						return res.json({
							success: true,
							message: "Tweet deleted successfuly",
						})
					})
					.catch(err => {
						console.error(err.message)
						return res.status(500).json({
							success: false,
							error: err.message,
						})
					})
			}
		})
		.catch(err => {
			console.error(err.message)
			return res.status(500).json({
				success: false,
				error: err.message,
			})
		})

	// delete likes under a tweet
}
