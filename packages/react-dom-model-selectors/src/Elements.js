const { expect } = require('chai');

const propKeysToDeleteInAssert = [
  'selectorClasses',
  'selectorID',
  'testID',
  'children',
  'accessible',
  'allowFontScaling',
  'ellipsizeMode'
];

class Elements extends Array {
  constructor(DOM, ExtendElements, nodeID) {
    super(0);

    this.DOM = DOM;
    this.ExtendElements = ExtendElements || Elements;
    this.nodeID = nodeID;

    const assert = (func) => (...args) => func(...args);

    this.assert = { not: {} };
    const assertions = ['countIs', 'textIs', 'exists', 'hasClass', 'hasID', 'propExists', 'propEquals', 'stateKeyExists', 'stateEquals'];

    assertions.forEach((assertionFuncName) => {
      this.assert[assertionFuncName] = (...args) => this[assertionFuncName](...args);

      this.assert.not[assertionFuncName] = (...args) => {
        let shouldThrow = false;

        try {
          this[assertionFuncName](...args);
          shouldThrow = true;
        } catch (e) {}

        if (shouldThrow) {
          throw new Error(`assert.${assertionFuncName} ran without an error. We're using "not" so it should have failed`);
        }
      }
    });
  }

  add(nodeIDs) {
    if (nodeIDs && nodeIDs.length) {
      nodeIDs.forEach((nodeID) => {
        const element = new this.ExtendElements(this.DOM, this.ExtendElements, nodeID)
        this.push(element);
      });
    }
  }

  finishFind() {
    if (this.length === 1) {
      this.nodeID = this[0].nodeID;
    }
  }

  getCount(groupByTestID) {
    if (this.nodeID) return 1;

    if (!groupByTestID) return this.length;

    let testIDs = [];

    this.forEach((element) => {
      const testID = element.getTestID();

      if (!testID) {
        throw new Error('You are using getCount(groupByTestID) with groupByTestID as true. This requires that every component your selector finds is using the selectors export to set the testID');
      }

      if (!testIDs.includes(testID)) testIDs.push(testID);
    });

    return testIDs.length;
  }

  countIs(count, groupByTestID) {
    const length = this.getCount(groupByTestID);

    if (length === count) return;

    if (groupByTestID) {
      throw new Error(`Count is: ${length}, expected: ${count}. Note groupByTestID has been set to true. So we can only count components using the selectors export`);
    }

    throw new Error(`Node count is: ${length}, expected: ${count}`);
  }

  getNode() {
    return this.DOM.nodeByNodeID[this.nodeID];
  }

  getTestID() {
    return this.DOM.testIDByNodeID[this.nodeID];
  }

  getOnlyTestID() {
    if (this.onlyTestID) return this.onlyTestID;

    this.exists();

    let testID = this.getTestID();
      
    if (!testID) {
      this.forEach((element) => {
        const elementTestID = element.getTestID();

        if (!testID && elementTestID) {
          testID = elementTestID;
        } else if (testID && elementTestID && testID !== elementTestID) {
          throw new Error('Multiple Test ID\'s found for elements with the given selector. This action can only be made on 1 testID. Focus your selector to pick just 1');
        }
      });
  
      if (!testID) {
        throw new Error('No testID found for the given selector. This action requires that you use selectors export to put an id on an element');
      }
    }

    this.onlyTestID = testID;

    return this.onlyTestID;
  }

  exists() {
    if (this.nodeID) return;

    if (this.length < 1) {
      throw new Error('No elements exist for the given selector');
    }
  }

  textIs(text) {
    this.assertSingleOrAtLeastOne((element) => {
      const { children } = element.getNode();

      if (children !== text) {
        throw new Error(`The given text does match the elements text.\nGiven: ${text}\nReceived: ${String(children)}`);
      }
    }, `The given text does match any of the elements text.`);
  }

  hasClass(className) {
    this.assertSingleOrAtLeastOne((element) => {
      const { props } = element.getNode();

      if (!props || !props.selectorClasses || !props.selectorClasses.includes(className)) {
        throw new Error(`The node does not contain the class ${className}`);
      }
    }, `None of the found elements have the class: ${className}`);
  }

  hasID(id) {
    this.assertSingleOrAtLeastOne((element) => {
      const { props } = element.getNode();

      if (!props || !props.selectorID || props.selectorID !== id) {
        throw new Error(`The node does not contain the id: ${id}`);
      }
    }, `None of the found elements have the id: ${id}`);
  }

  propExists(key) {
    this.argExists('props', key);
  }

  propEquals(key, value) {
    this.argEquals('props', key, value);
  }

  stateKeyExists(key) {
    this.argExists('state', key);
  }

  stateEquals(key, value) {
    this.argEquals('state', key, value);
  }

  argExists(arg, propKey) {
    this.assertSingleOrAtLeastOne((element) => {
      const node = element.getNode();

      const props = node[arg];

      if (!props || props[propKey] === undefined) {
        throw new Error(`The node does not have the ${arg}: ${propKey}`);
      }
    }, `None of the found elements have the ${arg}: ${propKey} specified`);
  }

  argEquals(arg, arg1, arg2) {
    let key;
    let val;

    if (arg2) {
      key = arg1;
      val = arg2;
    } else {
      val = arg1;
    }

    this.assertSingleOrAtLeastOne((element) => {
      const node = element.getNode();

      const props = node[arg];

      let error = false;

      try {
        if (!key) {
          propKeysToDeleteInAssert.forEach((propKey) => {
            delete props[propKey]
          });

          expect(props).to.deep.equal(val);
        } else {
          expect(props[key]).to.deep.equal(val);
        }
      } catch (e) {
        error = true;
      };

      if (!props || error) {
        if (key) {
          throw new Error(`The nodes ${arg} does not equal the supplied value`);
        }
        
        throw new Error(`The nodes ${key} ${arg} does not equal the supplied value`);
      }
    }, key ? 
      `None of the found elements have the a "${key}" ${arg} that matches the supplied value` : 
      `None of the found elements have ${arg} that matches the supplied value`
    );
  }

  assertSingleOrAtLeastOne(func, errorText) {
    if (this.nodeID) {
      func(this);
    } else {
      let atLeastOne = this.atLeastOnePasses((element) => {
        func(element);
      });

      if (!atLeastOne) {
        throw new Error(errorText);
      }
    }
  }
  
  atLeastOnePasses(func) {
    let atLeastOnePasses = false;

    this.forEach((elements) => {
      try {
        func(elements);
        atLeastOnePasses = true;
      } catch (e) {}
    });

    return atLeastOnePasses;
  }

  getProps(allowMultiple) {
    if (this.nodeID) {
      return this.getNode().props;
    }

    this.exists();

    if (this.length === 1) {
      return this[0].getProps();
    }

    if (!allowMultiple) {
      throw new Error('Multiple elements found for the given selector, pass true to getProps(true) to return all the props as an array. Or narrow your selector');
    }

    return this.map((element) => {
      return element.getProps(allowMultiple);
    });
  }
}

module.exports = Elements;