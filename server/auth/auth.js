var errs = require('restify-errors');

module.exports = {
  requireLogin: function (request) {
    if (!request?.session?.user?.userId) {
      throw new errs.UnauthorizedError("You must be signed in to see this")
    }
    return request.session.user;
  }
}