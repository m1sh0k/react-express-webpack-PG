var User = require('./models/index').User;

module.exports = async function(req, res, next) {
    try {
        req.user = res.locals.user = null;
        if (!req.session.user) return next();
        //console.log("db loadUser req.session.user: ", req.session.user);
        let user = await User.findByPk(req.session.user);//User.findByPk(req.session.user);
        //console.log("db loadUser: ", user);
        req.user = res.locals.user = user;
        next();
    }catch (err){
        return next(err);
    }
};