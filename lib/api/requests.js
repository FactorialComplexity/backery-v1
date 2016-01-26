var requests = module.exports = {};

var Actions = {
    Create,
    Update,
    Fetch,
    Query,
    Destroy
}

requests.CreateRequest = function(entityDefinition, values) {
    this.entityDefinition = entityDefinition;
    this.values = values;
}

requests.UpdateRequest = function(entityDefinition, objectId, values) {
    this.entityDefinition = entityDefinition;
}

requests.FetchRequest = function(entityDefinition, objectId) {
    this.entityDefinition = entityDefinition;
}

requests.QueryRequest = function(entityDefinition, where, include, offset, limit) {
    this.entityDefinition = entityDefinition;
}

requests.DestroyRequest = function(entityDefinition, objectId) {
    this.entityDefinition = entityDefinition;
}
