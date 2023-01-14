var errs = require('restify-errors');

module.exports = {
  requireLogin: function (request) {
    if (!request?.user?.steamId) {
      throw new errs.UnauthorizedError("You must be signed in with Steam")
    }
    return request.user;
  }
}