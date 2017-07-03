const IO = require('socket.io')

module.exports = function (http, application) {

    const namespaces = application.getSocketNamespaces()
    const Backery = application.Backery;
    const io = IO(http);
    const context = application.getRequestContextNamespace()


    Object.keys(namespaces).forEach(nsp => {
        const namespace = io.of(nsp)
        namespace.use(mockAuth)

        namespace.on('connection', function(socket) {
            console.log(`User ${socket.user.objectId()} connected`)

            const originalOn = socket.on.bind(socket)
            socket.on = (eventName, callback) =>
                originalOn(eventName, (...args) =>
                    runInContext(context, socket.user, () => callback(...args))
                )
            socket.namespace = namespace

            namespaces[nsp](socket);

            socket.on('error', (error) => {
                console.log(error)
            })

            socket.on('disconnect', () => {
                console.log(`User ${socket.user.objectId()} disconnected`);
                socket.removeAllListeners();
            });
        });
    });

    return Object.keys(namespaces)

    function mockAuth (socket, next) {
        // TODO: check smth like socket.request.headers.authorization against Backery.Context.user (?)
        Backery.Model.User.query()
        .where('id', socket.handshake.query.userId)
        .include('profile')
        .findOne()
        .then(user => {
            if (!user) {
                return next(new Error('Unauthorized'))
            }
            socket.user = user
            next();
        })
    }
}

function runInContext (context, user, run) {
    context.run(function(outer) {
        context.set('user', user);
        run();
    });
};
