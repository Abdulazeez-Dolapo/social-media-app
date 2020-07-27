const { admin, db } = require("../util/admin")

verifyToken = (req, res, next) => {
	let token
	if (req.headers.authorization) {
		token = req.headers.authorization
		if (req.headers.authorization.startsWith("Bearer "))
			token = req.headers.authorization.split(" ")[1]
	} else {
		return res.status(401).json({
			success: false,
			error: "Unauthorized",
		})
	}

	admin
		.auth()
		.verifyIdToken(token)
		.then(decodedToken => {
			req.user = decodedToken
			return db
				.collection("users")
				.where("id", "==", req.user.uid)
				.limit(1)
				.get()
		})
		.then(data => {
			req.user.handle = data.docs[0].data().handle
			req.user.imageUrl = data.docs[0].data().imageUrl
			return next()
		})
		.catch(err => {
			console.error("verify token ", err)
			return res.status(401).json({
				success: false,
				error: err.message,
			})
		})
}

module.exports = verifyToken
