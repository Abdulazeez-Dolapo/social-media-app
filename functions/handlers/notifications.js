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
