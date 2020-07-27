const isEmpty = string => {
	if (string.trim() === "") return true
	else return false
}

const isEmail = email => {
	const regExp = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
	if (email.match(regExp)) return true
	else return false
}

exports.validateSignUpData = data => {
	let errors = {}

	if (isEmpty(data.email)) errors.email = "Email must not be empty"
	if (!isEmail(data.email)) errors.email = "Please enter a valid email"

	if (isEmpty(data.password)) errors.password = "Password must not be empty"
	if (data.password !== data.confirmPassword)
		errors.confirmPassword = "Passwords must match"

	if (isEmpty(data.handle)) errors.handle = "Handle must not be empty"

	return {
		errors,
		valid: Object.keys(errors).length === 0 ? true : false,
	}
}

exports.validateLoginData = data => {
	let errors = {}

	if (isEmpty(data.email)) errors.email = "Email must not be empty"
	if (!isEmail(data.email)) errors.email = "Please enter a valid email"

	if (isEmpty(data.password)) errors.password = "Password must not be empty"

	return {
		errors,
		valid: Object.keys(errors).length === 0 ? true : false,
	}
}

exports.validateBioData = data => {
	let userDetails = {}

	if (!isEmpty(data.bio.trim())) userDetails.bio = data.bio.trim()
	if (!isEmpty(data.location.trim()))
		userDetails.location = data.location.trim()
	// Check if website has http and if it doesn't, add it to the website
	if (!isEmpty(data.website.trim())) {
		if (data.website.trim().substring(0, 4) !== "http") {
			userDetails.website = `http://${data.website.trim()}`
		} else userDetails.website = data.website.trim()
	}

	return userDetails
}
