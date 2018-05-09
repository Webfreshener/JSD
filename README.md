RxVO
=============
**Reactive Validating Object**<br/>
RxJS + JSON-Schema (Ajv) Based Observable Data Models

[![Build Status](https://travis-ci.org/Webfreshener/RxVO.svg?branch=master)](https://travis-ci.org/Webfreshener/RxVO)
[![Dev Dependency Status](https://david-dm.org/webfreshener/RxVO/dev-status.svg)](https://david-dm.org/webfreshener/RxVO?type=dev)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c665c70dfeb144319bc5bbd58695eb90)](https://www.codacy.com/app/vanschroeder/RxVO?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=Webfreshener/RxVO&amp;utm_campaign=Badge_Grade)
[![Codacy Badge](https://api.codacy.com/project/badge/Coverage/c665c70dfeb144319bc5bbd58695eb90)](https://www.codacy.com/app/vanschroeder/RxVO?utm_source=github.com&utm_medium=referral&utm_content=Webfreshener/RxVO&utm_campaign=Badge_Coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/625326e1880421ccc809/maintainability)](https://codeclimate.com/github/Webfreshener/RxVO/maintainability)

[Online Developer Documentation](https://webfreshener.github.io/RxVO/)

## &#9888; Caution!
This utility is not meant for general purpose use. It leverages several technologies such as RxJS, JSON-Schema and Proxy. As such it is not performant or suitable for applications that require a high degree of efficiency. However it should be fine for prototyping and single-user use in browsers or other sandboxed environments

### Goals 
 * Provide a means to quickly and easily validate complex datasets
 * Look and feel like a standard JS Object for ease of use and adaptability
 * Automate creation of RxJS Update and Error notifications 

### Table of Contents

**[Installation Instructions](#installation-instructions)**

**[Usage Example](#usage-example)**

**[Developer Guide](#developer-guide)**
  * [RxVO Class](#rxvo-class)
    * [Schemas Config](#rxvo-schemas-config)
    * [Model Proxy Object](#model-proxy-object)
    * [model vs $model](#model-vs-$model)
  * [Model Class](#model-class)
  * [PropertiesModel](#properties-model)
  * [ItemsModel](#items-model)

#### Installation Instructions
```
// this package is not yet published
// for now use git+https and manually add to package.json
dependencies: {
...
"rxvo": "git+https://github.com/webfreshener/RxVO.git",
...
}
```

#### Usage Example 

The example below defines a Model that expects a `name` value and 
list of `topScores` items

```
// JSON-SCHEMA for Scores Collection
const schema = {
    "id": "root#",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
        },
        "topScores": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string"
                    },
                    "score": {
                        "type": "integer",
                        "default": 0
                    }
                },
                "required": ["name"]
            }
        }
    },
    required: ["name", "topScores"],
};


// instantiate our Model
const obj = new RxVO({schemas: [schema]});

// subscribes an observer to the Model
obj.subscribe({
    next: function (ref) {
        console.log("\t>> update succeeded!\n\t%s\n\t%s\n\n",
            "current object state:", "" + JSON.stringify(ref));
        doTask.next()
    },
    complete: function (ref) {
        console.log("\t>> %s",
            "object is frozen and no longer editable");
        doTask.next()
    },
    error: function (e) {
        console.log("\t>> update FAILED with error:\n\t%s\n",
            JSON.stringify(e));
        console.log("\tcurrent object state:\n\t%s\n", obj);
        doTask.next();
    },
});

// populate the RxVO with data
// -- this will trigger the "next" notification
obj.model = {
    name: "JSONville",
    topScores: [{
        name: "Player 1",
        score: 12300000,
    }, {
        name: "Player 2",
        score: 45600000,
    }, {
        name: "Player 3",
        score: 78900000,
    }]
};

// update the rxVO
// this will trigger the next notification
obj.model.topScores[0].score++;

// invalid attempt update the rxVO
// this will trigger the error notification
// reason: "topScores/items/score" is type is integer 
obj.model.topScores[0].score = "1234";

// invalid attempt update the rxVO
// this will trigger the error notification
// reason: "topScores" is marked as required
delete obj.model.topScores;

```
Refer to the examples demo in `./examples/basic-usage` for more usage examples

## Developer Guide

#### RxVO Class ####
This class represents the Document entry point

| Method        | Arguments | Description  |
|:--------------|:----------|:-------|
| constructor   | [schemas config](#rxvo-schemas-config) (object), [options (object)] | creates new RxVO instance |
| errors [getter]   | | retrieves errors (if any) from last json-schema validation |
| model [getter/setter]   | | retrieves root [model proxy object](#model-proxy-object) for operation |
| getModelsInPath   | to (string) | retrieves models at given path |
| getSchemaForKey   | key (string) | retrieves json-schema with given key as ID |
| getSchemaForPath   | path (string) | retrieves json-schema for model at given path |
| schema [getter]   | | retrieves json-schema for root model |
| subscribe   |  observers (object) | Subscribes Observers to the RxVO Model Root |
| subscribeTo   |  path (string), observers (object) | Subscribes Observers to the Model at path 
| toString   | | retrieves root model as JSON String |
| toJSON   | | retrieves root model as JSON Object |
| validate   | path (string), value (object) | validates data at given ath against JSON-Schema |
| *static* fromJSON   | json (string &#124; object) | creates new RxVO from static method |

##### RxVO Schemas Config
| Property        | Type | Description  |
|:--------------|:----------|:-------|
| meta | array | Array of MetaSchema references to validate Schemas against
| schemas | array | Array of Schema references to valdiate data against 
| use | string | key/id of schema to use for data validation

##### Model Proxy Object 

This is the Data Model most usage will be based around.
It is a Proxy Object that has traps for all operations that alter the state of the given Array or Object

| Property        | Type | Description  |
|:--------------|:----------|:-------|
| $model | (object  &#124; array) | references Proxy Object owner class

##### model vs $model 

In usage, `model` always references the Proxied Data Model for validation and operation where `$model` references the owner Model Class
*example:*
```
 const _rxvo = new RxVO({schemas: [schema]});
 
 // access the root model:
 console.log(`JSON.stringify(_rxvo.model)`);
 
 // access the model's owner Model Class:
 const owner = _rxvo.model.$model;
 console.log(`is frozen: ${owner.isFrozen}`);
 
 // call toString on Owner
 console.log(`stringified: ${owner}`);
 
 // obtain model from  it's Owner
  console.log(`stringified: ${JSON.stringify(owner.model)}`);
 
```

#### Model Class ####
| Method        | Arguments | Description  |
|:--------------|:----------|:-------|
| freeze | | applies Object.freeze to model hierarchy |
| isDirty [getter]   | | returns dirtyness of model heirarchy (is dirty if operation in progress) |
| isFrozen [getter]   | | returns Object.freeze status of Model hierarchy |
| jsonPath [getter]   | | retrieves json path string for Model instance. eg: "this.is.my.path" |
| model [getter/setter]   | | retrieves root model for operation |
| subscribe   |  observers (object) | Subscribes Observers to the RxVO Model Root |
| subscribeTo   |  path (string), observers (object) | Subscribes Observers to the Model at path |
| model [getter/setter]   | | setter/getter for [model proxy object](#model-proxy-object) for operation |
| objectID [getter]   | | retrieves Unique ObjectID of Model instance |
| options [getter]   | | retrieves options passed to Model instance |
| path [getter]   | | retrieves json-schema path string for Model instance. eg: "#/this/is/my/path" |
| parent [getter]   | | retrieves Model's parent Model instance |
| reset | | resets model to initial state if operation is valid |
| root [getter]   | | retrieves root Model instance |
| rxvo [getter]   | | retrieves Model's RxVO document instance |
| toString   | | retrieves root model as JSON String |
| toJSON   | | retrieves root model as JSON Object |
| validate   | path (string), value (object) | validates data at given ath against JSON-Schema |
| validationPath [getter] | | retrieves json-schema path string for Model validation |

#### PropertiesModel ####
###### subclass of [Model Class](#model-class)

| Method        | Arguments | Description  |
|:--------------|:----------|:-------|
| get | key (string) | applies Object.freeze to model hierarchy |
| set | key (string), value (any) | applies Object.freeze to model hierarchy |

Allows model reference to be treated as Object with all array prototype methods available

#### ItemsModel ####
###### subclass of [Model Class](#model-class)
Allows model reference to be treated as Array with all array prototype methods available

