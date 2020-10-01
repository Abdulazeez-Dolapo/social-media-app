const { db } = require("../util/admin")

exports.markAsRead = (req, res) => {
	const batch = db.batch()

	req.body.forEach(notificationId => {
		const notification = db.doc(`/notifications/${notificationId}`)
		batch.update(notification, { read: true })
	})

	batch
		.commit()
		.then(() => {
			return res.json({
				success: true,
				message: "Notifications successfully marked as read",
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

exports.getUserNotifications = (req, res) => {
	db.collection("notifications")
		.where("recipient", "==", req.user.handle)
		.orderBy("createdAt", "desc")
		.get()
		.then(data => {
			let notifications = []
			data.forEach(doc => {
				notifications.push({
					id: doc.id,
					...doc.data(),
				})
			})
			return res.json({
				success: true,
				message: "Notifications found",
				notifications,
			})
		})
		.catch(err => console.error(err))
}
