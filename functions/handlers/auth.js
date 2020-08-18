const { firebaseConfig } = require("../config/config")
const { admin, db } = require("../util/admin")
const {
	validateSignUpData,
	validateLoginData,
	validateBioData,
} = require("../util/validators")

const firebase = require("firebase")

// Initialize Firebase
firebase.initializeApp(firebaseConfig)

exports.signUp = (req, res) => {
	const newUser = {
		email: req.body.email,
		password: req.body.password,
		confirmPassword: req.body.confirmPassword,
		handle: req.body.handle,
	}

	const { valid, errors } = validateSignUpData(newUser)
	if (!valid) {
		return res.status(400).json({
			success: false,
			error: errors,
		})
	}

	const defaultImage = "blank.png"
	let token, userId
	db.doc(`users/${newUser.handle}`)
		.get()
		.then(doc => {
			if (doc.exists) {
				return res.status(400).json({
					success: false,
					handle: "This handle is taken. Please try another",
				})
			} else {
				return firebase
					.auth()
					.createUserWithEmailAndPassword(newUser.email, newUser.password)
			}
		})
		.then(data => {
			userId = data.user.uid
			return data.user.getIdToken()
		})
		.then(token => {
			token = token
			const userCredentials = {
				handle: newUser.handle,
				email: newUser.email,
				createdAt: new Date().toISOString(),
				imageUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${defaultImage}?alt=media`,
				id: userId,
			}

			return db.doc(`/users/${newUser.handle}`).set(userCredentials)
		})
		.then(() => {
			return res.json({
				success: true,
				message: `Welcome ${newUser.handle}! Your account was created successfully`,
				token,
			})
		})
		.catch(err => {
			console.error(err)
			if (err.code === "auth/email-already-in-use") {
				return res.status(400).json({
					success: false,
					general: err.message,
				})
			} else {
				return res.status(500).json({
					success: false,
					error: err.message,
				})
			}
		})
}

exports.login = (req, res) => {
	const user = {
		email: req.body.email,
		password: req.body.password,
	}

	const { valid, errors } = validateLoginData(user)
	if (!valid) {
		return res.status(400).json({
			success: false,
			error: errors,
		})
	}

	firebase
		.auth()
		.signInWithEmailAndPassword(user.email, user.password)
		.then(data => {
			return data.user.getIdToken()
		})
		.then(token => {
			return res.json({
				success: true,
				token,
			})
		})
		.catch(err => {
			console.error(err)
			return res.status(403).json({
				success: false,
				error: { general: "Email or password incorrect" },
			})
		})
}

exports.uploadImage = (req, res) => {
	const BusBoy = require("busboy")
	const path = require("path")
	const os = require("os")
	const fs = require("fs")

	const busboy = new BusBoy({ headers: req.headers })

	let imageName
	let imageToBeUploaded

	busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
		if (
			mimetype !== "image/jpeg" &&
			mimetype !== "image/jpg" &&
			mimetype !== "image/png"
		) {
			return res.status(400).json({
				success: false,
				error: "Wrong file type. Only jpeg and png files are allowed",
			})
		}
		const imageExtension = filename.split(".")[filename.split(".").length - 1]
		// Generate random file name
		imageName = `${Math.round(Math.random() * 1000000000)}.${imageExtension}`
		const filepath = path.join(os.tmpdir(), imageName)

		imageToBeUploaded = { filepath, mimetype }
		file.pipe(fs.createWriteStream(filepath))
	})

	busboy.on("finish", () => {
		admin
			.storage()
			.bucket()
			.upload(imageToBeUploaded.filepath, {
				resumable: false,
				metadata: {
					metadata: {
						contentType: imageToBeUploaded.mimetype,
					},
				},
			})
			.then(() => {
				const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageName}?alt=media`
				return db.doc(`/users/${req.user.handle}`).update({ imageUrl })
			})
			.then(() => {
				return res.json({
					success: true,
					message: "Image uploaded successfully",
				})
			})
			.catch(err => {
				return res.status(500).json({
					success: false,
					error: err.message,
				})
			})
	})

	busboy.end(req.rawBody)
}

exports.getAuthenticatedUserDetails = (req, res) => {
	let userData = {}
	db.doc(`/users/${req.user.handle}`)
		.get()
		.then(doc => {
			if (doc.exists) {
				userData.credentials = doc.data()
				return db
					.collection("likes")
					.where("handle", "==", req.user.handle)
					.get()
			}
		})
		.then(docs => {
			userData.likes = []
			docs.forEach(doc => {
				userData.likes.push(doc.data())
			})

			return db
				.collection("notifications")
				.where("recipient", "==", req.user.handle)
				.orderBy("createdAt", "desc")
				.get()
		})
		.then(docs => {
			userData.notifications = []
			docs.forEach(doc => {
				userData.notifications.push({
					recipient: doc.data().recipient,
					sender: doc.data().sender,
					type: doc.data().type,
					read: doc.data().read,
					tweetId: doc.data().tweetId,
					createdAt: doc.data().createdAt,
					id: doc.id,
				})
			})
			return res.json({
				success: true,
				userData,
			})
		})
		.catch(err => {
			console.error(err)
			return res.status(500).json({
				success: false,
				error: err.message,
			})
		})
}

exports.updateUserDetails = (req, res) => {
	let userDetails = validateBioData(req.body)

	db.doc(`/users/${req.user.handle}`)
		.update(userDetails)
		.then(() => {
			return res.json({
				success: true,
				message: "User details updated successfully",
			})
		})
		.catch(err => {
			console.error(err)
			return res.status(500).json({
				success: false,
				error: err.message,
			})
		})
}

exports.getUserDetails = (req, res) => {
	let userData = {}
	db.doc(`/users/${req.params.handle}`)
		.get()
		.then(doc => {
			if (doc.exists) {
				userData.user = doc.data()
				return db
					.collection("tweets")
					.where("userHandle", "==", req.params.handle)
					.orderBy("createdAt", "desc")
					.get()
			}
		})
		.then(docs => {
			userData.tweets = []
			docs.forEach(doc => {
				const tweet = doc.data()
				tweet.id = doc.id
				userData.tweets.push(tweet)
			})
			return res.json({
				success: true,
				userData,
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
