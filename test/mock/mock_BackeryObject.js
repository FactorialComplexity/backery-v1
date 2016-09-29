/**
 * A very simple mock for BackeryObject. Can return objectId and values
 * for keys. Cannot be modified once initialized.
 */
module.exports = function(data, Backery) {
    return {
        objectId: function() {
            return data.id;
        },
        
        get: function(key) {
            return data[key];
        }
    };
};
