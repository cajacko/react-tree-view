const Elements = require('./Elements');

const ReactNativeComponents = ['View', 'TouchableHighlight', 'Text'];
const NativeComponents = ['RCTView', 'RCTText'];

class DOM {
  constructor(ExtendElements) {
    this.Elements = ExtendElements || Elements;
    this.nodeByNodeID = {};
    this.nodeIDsByTestID = {};
    this.nodeIDsBySelectorID = {};
    this.nodeIDsByClasses = {};
    this.nodeIDsByType = {};
    this.positionByNodeID = {};
    this.selectorIDByNodeID = {};
    this.testIDByNodeID = {};
    this.classesByNodeID = {};
    this.typeByNodeID = {};
    this.childrenNodeIDsByNodeID = {}; 
    
    this.addNode = this.addNode.bind(this);
  }

  addToPropArray(prop, key, val) {
    if (!this[prop][key]) this[prop][key] = [];

    this[prop][key].push(val);
  }

  addNode(node) {
    const { id, name, children, props: { testID, selectorID, selectorClasses } } = node;

    this.nodeByNodeID[id] = node;
    this.addToPropArray('nodeIDsByType', name, id);
    this.typeByNodeID[id] = name;

    if (children) {
      const childrenArray = Array.isArray(children) ? children : [children];
      this.childrenNodeIDsByNodeID[id] = childrenArray;

      childrenArray.forEach((nodeID, i) => {
        this.positionByNodeID[nodeID] = i + 1;
      });
    }

    if (testID) {
      this.addToPropArray('nodeIDsByTestID', testID, id);
      this.testIDByNodeID[id] = testID;
    }

    if (selectorID) {
      this.addToPropArray('nodeIDsBySelectorID', selectorID, id);
      this.selectorIDByNodeID[id] = selectorID;
    }

    if (selectorClasses) {
      selectorClasses.forEach((selectorClass) => {
        this.addToPropArray('nodeIDsByClasses', selectorClass, id);
        this.addToPropArray('classesByNodeID', id, selectorClass);
      })
    }
  }

  find(selector) {
    const elements = new this.Elements(this, this.Elements);

    const ancestorSelectors = [];

    selector.split(' ').forEach((ancestors) => {
      const separatedAncestor = ancestors.replace('.', ' .').replace('#', ' #').replace(':', ' :');
      const sameNodeSelectors = separatedAncestor.split(' ').filter((string) => string !== '');

      ancestorSelectors.push(sameNodeSelectors);
    });

    let nodeIds = [];

    const hasNodes = !ancestorSelectors.find((sameNodeSelectors, j) => {
      let sameNodeSelectorNodeId = [];

      const filterSameNodes = (newNodes) => {
        if (j === 0) {
          sameNodeSelectorNodeId = newNodes;
        } else {
          sameNodeSelectorNodeId = sameNodeSelectorNodeId.filter((nodeID) => {
            return newNodes.includes(nodeID);
          });
        }
      }

      const nothingFound = !!sameNodeSelectors.find((sameNodeSelector, i) => {
        if (sameNodeSelector.includes('#')) {
          const id = sameNodeSelector.replace('#', '');
      
          if (this.nodeIDsBySelectorID[id]) {
            filterSameNodes(this.nodeIDsBySelectorID[id]);
            return false;
          }
        } else if (sameNodeSelector.includes('.')) {
          const className = sameNodeSelector.replace('.', '');
      
          if (this.nodeIDsByClasses[className]) {
            filterSameNodes(this.nodeIDsByClasses[className]);
            return false;
          }
        } else if (sameNodeSelector.includes(':')) {
          if (!sameNodeSelector.includes(':nth-child')) {
            throw new Error('If a selector contains a ":" it is expected to read ":nth-child(x)" with a number instead of the x');
          }

          if (i === 0) {
            throw new Error(':nth-child can\'t be the first statement in a selector block');
          }

          const nthChild = sameNodeSelector.match(/(\d+\.?\d*)/g)[0];
          const position = parseInt(nthChild, 10);

          if (isNaN(position)) {
            throw new Error(`Could not get int from ${sameNodeSelector}`);
          }
          
          sameNodeSelectorNodeId = sameNodeSelectorNodeId.filter((nodeID) => {
            return this.positionByNodeID[nodeID] === position;
          });

          if (sameNodeSelectorNodeId.length) return false;
        } else {
          if (this.nodeIDsByType[sameNodeSelector]) {
            filterSameNodes(this.nodeIDsByType[sameNodeSelector]);
            return false;
          }
        }

        return true;
      });

      if (nothingFound) return true;

      // Combine nodes if ancestors
      nodeIds = nodeIds.concat(sameNodeSelectorNodeId);

      return false;
    });

    if (hasNodes) {
      elements.add(nodeIds);
    }

    elements.finishFind();

    return elements;
  }
}

module.exports = DOM;