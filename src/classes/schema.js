import {
    _mdRef, _required_elements, _object, _kinds, _exists,
    _schemaHelpers, _schemaOptions, _schemaSignatures, _validPaths
} from "./_references";
import {MetaData} from "./_metaData";
import {SchemaHelpers} from "./_schemaHelpers";
import {SchemaValidator} from "./_schemaValidator";
import {JSD} from "./jsd";
import {Model} from "./model";
/**
 * @class Schema
 */
export class Schema extends Model {
    /**
     * @constructor
     * @param {Object} _o - schema definition object
     * @param {Object} opts - schema options
     */
    constructor(_signature, opts = {extensible: false, debug:false}) {
        super();
        var eMsg;
        if (!_exists(_signature)) {
            throw `Schema requires JSON object at arguments[0]. Got '${typeof _signature}'`;
        }
        _schemaOptions.set(this, opts);
        _required_elements.set(this, []);

        // tests for metadata
        if (!(this instanceof MetaData)) {
            let _md;
            if (arguments[2] instanceof JSD) {
                _md = new MetaData(this, {
                    _path: "",
                    _root: this,
                    _jsd: arguments[2],
                });
            }
            else if (typeof arguments[2] == "object") {
                if (arguments[2] instanceof MetaData) {
                    _md = arguments[2];
                } else {
                    _md = new MetaData(this, arguments[2]);
                }
            } else {
                throw `Invalid constructor call for Schema: ${JSON.stringify(arguments)}`
            }
            _mdRef.set(this, _md);
        }

        // traverses elements of schema checking for elements marked as reqiured
        if (_exists(_signature.elements)) {
            _signature = _signature.elements;
            for (let _sigEl of Object.keys(_signature)) {
                // -- tests for element `required`
                let _req = _signature[_sigEl].required;
                if (_req) {
                    // -- adds required element to list
                    let req = _required_elements.get(this);
                    req.push(_sigEl);
                    _required_elements.set(this, req);
                }
            }
        }

        // attempts to validate provided `schema` entries
        let _sV = new SchemaValidator(_signature, Object.assign(this.options || {}, {
            jsd: _mdRef.get(this).jsd,
        }));

        // throws error if error message returned
        if (typeof (eMsg = _sV.isValid()) === "string") {
            throw eMsg;
        }

        if (_signature.hasOwnProperty('polymorphic')) {
            // _signature = _signature.polymorphic;
        }

        _schemaSignatures.set(this, _signature);
        _schemaHelpers.set(this, new SchemaHelpers(this));
        _schemaHelpers.get(this).walkSchema(_signature || JSD.defaults, this.path);

        // creates model
        _object.set(this, new Proxy({}, this.handler));

        // attempts to set default value
        for (let _sigEl of Object.keys(_signature)) {
            // -- tests for element `default`
            let _default = _signature[_sigEl].default;
            if (_exists(_default)) {
                // sets default value for key on model
                let _p = _sigEl.split(".");
                this.model[_sigEl] = _default;
            }
        }
    }

    /**
     * Handler for Object Proxy Evaluation
     * @returns {{get: function, set: function}}
     */
    get handler() {
        return {
            get: (t, key) => {
                const _m = t[key];
                return _m instanceof Schema ? _m.model : _m;
            },
            set: (t, key, value) => {
                let _sH = _schemaHelpers.get(this);
                if (typeof key === "object") {
                    const e = _sH.setObject(key);
                    if (typeof e === "string") {
                        this.observerBuilder.error(this.path, e);
                        return false;
                    }
                    _validPaths.get(this.jsd)[this.path] = true;
                    return this.observerBuilder.next(this.path, this.toJSON());
                }

                let _childSigs = this.signature.elements || this.signature;
                let _pathKeys = key.split(".");

                if (_sH.testPathkeys(t, _pathKeys, _childSigs, value)) {
                    let kP = Schema.concatPathAddr(this.path, key);
                    _validPaths.get(this.jsd)[kP] = true;
                    t[key] = ((typeof value) === "object") ?
                        _sH.setChildObject(key, value) : value;
                }

                const _e = this.validate();
                if ((typeof _e) !== "string") {
                    if (this.path.length) {
                        const _p = Schema.concatPathAddr(this.path, key);
                        this.observerBuilder.next(_p, value);
                    }
                    return true;
                } else {
                    this.observerBuilder.error(this.path, _e);
                    return false;
                }
            }

        };
    }

    static concatPathAddr(path, addr) {
        return path.length ? `${path}.${addr}` : addr;
    }

    /**
     * @returns schema signature object
     */
    get signature() {
        return _schemaSignatures.get(this);
    }

    /**
     * getter for object model
     */
    get model() {
        return _object.get(this);
    }

    /**
     * setter for object model
     * @param value
     */
    set model(value) {
        let e;
        if (typeof value === "object") {
            const keys = Object.keys(value);
            if (keys.length) {
                keys.forEach((k) => {
                    // -- added try/catch to avoid error in jsfiddle
                    try {
                        this.model[k] = value[k];
                    } catch (e) {
                        // -- no-op
                    }
                });
            } else {
                e = "null not allowed";
                _validPaths.get(this.jsd)[this.path] = e;
            }
            _validPaths.get(this.jsd)[this.path] = true;
            if (this.isValid) {
                this.observerBuilder.next(this.path, this);
            }
            return true;
        } else {
            e = `unable to set scalar value on model at ${this.path.length ? this.path : "."}`;
            _validPaths.get(this.jsd)[this.path] = e;
            this.observerBuilder.error(this.path, e);
            return false;
        }
    }


    /**
     * @param {string} key
     * @returns {any}
     */
    get(key) {
        return this.model[key];
    }

    /**
     * sets value to schema key
     * @param {string|object} key
     * @param {any} value
     */
    set(key, value) {
        let kPath = this.path;
        if (typeof key === "string") {
            _validPaths.get(this.jsd)[this.path] = null;
            this.model[key] = value;
            let valid = this.validate();
            if (typeof valid === 'string') {
                kPath = Schema.concatPathAddr(this.path, key);
                this.observerBuilder.error(this.path, valid);
            }
        } else {
            const _sH = _schemaHelpers.get(this);
            let e = _sH.ensureRequiredFields(key);
            _validPaths.get(this.jsd)[this.path] = e;
            if (typeof e === "string") {
                return false;
            }
            Object.keys(key).forEach((_k) => {
                this.model[_k] = key[_k];
            });
        }
        this.observerBuilder.next(this.path, this.toJSON());
        return this;
    }

    /**
     * indicates if Schema will accept arbitrary keys
     * @returns {boolean}
     */
    get isExtensible() {
        return _exists(this.signature.extensible) ?
            this.signature.extensible : this.options.extensible || false;
    }

    /**
     * get options (if any) for this model"s schema
     */
    get options() {
        return _schemaOptions.get(this);
    }

    /**
     * @returns list of required elements on this Schema
     */
    get requiredFields() {
        return _required_elements.get(this);
    }

    /**
     * Base Signature for all Schema Objects
     */
    static defaultSignature() {
        return {
            type: "*",
            required: true,
            extensible: false
        };
    }
}
