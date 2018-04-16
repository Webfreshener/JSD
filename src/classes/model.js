import {
    _mdRef, _oBuilders, _exists,
    _object, _schemaOptions, _dirtyModels
} from "./_references";
import {JSD} from "./jsd";
import {MetaData} from "./_metaData";
import {makeClean, makeDirty, refValidation} from "./utils";

/**
 *
 * @param ref
 * @param metaRef
 */
const createMetaDataRef = (ref, metaRef) => {
    let _md;
    if (metaRef instanceof JSD) {
        // root properties are handed the JSD object
        // will create new MetaData and set reference as root element
        _md = new MetaData(ref, {
            _path: "",
            _parent: null,
            _root: ref,
            _jsd: metaRef,
        });
    }
    else if ((typeof metaRef) === "object") {
        // extends MetaData reference
        if (metaRef instanceof MetaData) {
            _md = metaRef;
        } else {
            // todo: re-evaluate this line for possible removal
            _md = new MetaData(this, metaRef);
        }
    } else {
        throw "Invalid attempt to construct Model." +
        "tip: use `new JSD([schema])` instead"
    }
    // sets MetaData object to global reference
    _mdRef.set(ref, _md);
};

/**
 *
 */
export class Model {
    constructor() {
        // tests if this is instance of MetaData
        if (!(this instanceof MetaData)) {
            createMetaDataRef(this, arguments[0]);
        }
    }

    /**
     * Subscribes handler method to observer for model
     * @param func
     * @returns {Observable}
     */
    subscribe(func) {
        return this.subscribeTo(this.path, func);
    }

    /**
     *
     * @return {object}
     */
    get handler() {
        return {
            setPrototypeOf: () => false,
            isExtensible: (t) => Object.isExtensible(t),
            preventExtensions: (t) => Object.preventExtensions(t),
            getOwnPropertyDescriptor: (t, key) => Object.getOwnPropertyDescriptor(t, key),
            defineProperty: (t, key, desc) => Object.defineProperty(t, key, desc),
            has: (t, key) => key in t,
            ownKeys: (t) => Reflect.ownKeys(t),
            apply: () => false,
        };
    }

    /**
     * Subscribes handler method to property observer for path
     * @param path
     * @param func
     * @return {Observable}
     */
    subscribeTo(path, func) {
        // throws if argument is not an object or function
        if ((typeof func).match(/^(function|object)$/) === null) {
            throw new Error("subscribeTo requires function");
        }

        // references the ObserverBuilder for the path
        let _o = _oBuilders.get(this.jsd).get(path);

        // creates observer reference for given `path` value
        if (!_o || _o === null) {
            _oBuilders.get(this.jsd).create(path, this);
            _o = _oBuilders.get(this.jsd).get(path);
        }

        // references to subscriptions for Observable
        const _subRefs = [];

        // init's observer handlers if defined on passed `func` object
        [
            {call: "onNext", func: "next"},
            {call: "onError", func: "error"},
            {call: "onComplete", func: "complete"},
        ].forEach((obs) => {
            if (func.hasOwnProperty(obs.func)) {
                _subRefs.push(_o[obs.call].subscribe({next: func[obs.func]}));
            }
        });

        // creates an extensible object to hold our unsubscribe method
        // and adds unsubscribe calls to the Proto object
        const _subs = (class {
        }).prototype.unsubscribe = () => {
            _subRefs.forEach((sub) => {
                sub.unsubscribe();
            });
        };

        return new _subs();
    }

    /**
     * stub for model getter, overridden by Model sub-class
     * @return {object|array|null}
     */
    get model() {
        return null;
    }

    /**
     * Raw value of this Model
     * @returns {*}
     */
    valueOf() {
        return _object.get(this);
    }

    /**
     * Provides JSON object representation of Model
     */
    toJSON() {
        let _derive = (itm) => {

            // uses toJSON impl if defined
            if (itm.hasOwnProperty("toJSON") &&
                (typeof this.toJSON) === "function") {
                return itm.toJSON();
            }

            // builds new JSON tree if value is object
            if (typeof itm === "object") {
                const _o = !Array.isArray(itm) ? {} : [];
                for (let k in itm) {

                    // we test for property to avoid warnings
                    if (itm.hasOwnProperty(k)) {

                        // applies property to tree
                        _o[k] = _derive(itm[k]);
                    }
                }

                // returns new JSON tree
                return _o;
            }
            // hands back itm if value wasn't usable
            return itm;
        };

        // uses closure for evaluation
        return _derive(this.valueOf());
    }

    /**
     * Provides JSON String representation of Model
     * @param pretty - `prettifies` JSON output for readability
     */
    toString(pretty = false) {
        return JSON.stringify(this.toJSON(), null, (pretty ? 2 : void(0)));
    }

    /**
     * Getter for Model's Unique Object ID
     * @returns {string} Object ID for Model
     */
    get objectID() {
        return _mdRef.get(this)._id;
    }

    /**
     * Getter for root element of Model hierarchy
     * @returns {Model}
     */
    get root() {
        return _mdRef.get(this).root || this;
    }

    /**
     * Getter for `path` to current Element
     * @returns {string}
     */
    get path() {
        let __ = _mdRef.get(this).path;
        return _exists(__) ? __ : "";
    }

    /**
     * Getter for Model's parent
     * @returns {Model}
     */
    get parent() {
        // attempts to get parent
        return _mdRef.get(this).parent;
    }

    /**
     * Getter for Model validation status for hierarchy
     * @return {boolean}
     */
    get isDirty() {
        let _res = _dirtyModels.get(this.jsd)[this.path];
        return _res === void(0) ? ((this.parent === null) ? false : this.parent.isDirty) : _res;
    }

    /**
     * Getter for model's JSD owner object
     * @returns {JSD}
     */
    get jsd() {
        return _mdRef.get(this).jsd;
    }

    /**
     * Get options (if any) for this model's schema
     * todo: review for possible removal
     * @return {any}
     */
    get options() {
        return _schemaOptions.get(this);
    }

    /**
     * Applies Object.freeze to model and triggers complete notification
     * -- unlike Object.freeze, this prevents modification
     * -- to all children in Model hierarchy
     * @returns {Model}
     */
    freeze() {
        Object.freeze(_object.get(this));
        const _self = this;
        setTimeout(() => {
            _oBuilders.get(_self.jsd).complete(_self.path, _self);
        }, 0);
        return this;
    }

    /**
     * Getter for Object.isFrozen status of this node and it's ancestors
     * @returns {boolean}
     */
    get isFrozen() {
        let _res = Object.isFrozen(_object.get(this));
        return !_res ? ((this.parent === null) ? false : this.parent.isFrozen) : _res;
    }

    /**
     * Provides formatted string for json-schema lookup
     * @return {string}
     */
    get validationPath() {
        return this.path === "" ? "root#/" : `root#${this.path}`;
    }

    /**
     * todo: implement with ajv
     * @returns {*}
     */
    get schema() {
        return this; // _validators.get(this.jsd).$ajv.compile({$ref: this.validationPath});
    }

    /**
     * todo: remove and standardize around `schema`
     * @returns {*}
     */
    get signature() {
        return this.schema;
    }

    /**
     * Tests value for validation without setting value to Model
     * @param {json} value - JSON value to test for validity
     * @return {boolean}
     */
    test(value) {
        try {
            if (!refValidation(this, value)) {
                // explicit failure on validation
                return false;
            }
        } catch (e) {
            // couldn't find schema, so is Additional Properties
            // todo: review `removeAdditional` ajv option for related behavior
            return true;
        }

        return true;
    }

    /**
     * resets Model to empty value
     * @return {Model}
     */
    reset() {
        const _isArray = Array.isArray(this.model);
        const _o = !_isArray ? {} : [];

        // validates that this model be returned to an empty value
        if (!this.test(_o)) {
            _oBuilders.get(this.jsd).error(this.path, this.jsd.errors);
            return this;
        }

        // marks this model as out of sync with tree
        makeDirty(this);

        // closure to handle the freeze operation safely
        const _freeze = (itm) => {
            if (!Object.isFrozen(itm)) {
               itm.freeze();
            }
        };

        // freezes all child Model/Elements
        // -- prevent changes to Children
        // -- sends "complete" notification to their Observers
        // -- revokes their Models if revocable
        const _i = !_isArray ? Object.keys(this.model) : this.model;
        _i.forEach((itm) => _freeze((!_isArray) ? _i[itm] : itm));

        // creates new Proxied Model to operate on
        const _p = new Proxy(Model.createRef(this, _o), this.handler);
        _object.set(this, _p);

        // marks this model as back in sync with tree
        makeClean(this);

        // sends notification of model change
        _oBuilders.get(this.jsd).next(this.path, this);

        return this;
    }

    /**
     * creates owner Model reference on Proxied data object
     * @param ref
     * @param obj
     * @returns {*}
     */
    static createRef(ref, obj) {
        Object.defineProperty(obj, "$ref", {
            value: ref,
            writable: false
        });
        return obj;
    };
}