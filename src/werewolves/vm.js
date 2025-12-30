// Sample viewModel object:
// {
//     'playerlist': [ { 'id': 'socketid1' }, { 'id': 'socketid2' } , { 'id': 'socketid3' } ],
//     'candidates': [ { 'id': 'socketid3', 'voters': [ { 'id': 'voter-socketid1' } ] }, { 'id': 'socketid4', 'voters': [ { 'id': 'voter-socketid2' } ] } ],
//     'voters': [ 'voter-socketid3', 'voter-socketid4' ],
// }

class viewModel {
    constructor() {
        const collection = document.body.getElementsByTagName('div');
        for (let i = 0; i < collection.length; i++) {
            const containerId = collection[i].id;
            this[containerId] = [];
        }
        // Also add a top-level container for the document body
        this['document'] = [];
    }

    // addDOMElement
    // this is the only method that accepts a DOM element as a parameter since this is the only way elements get inserted into the viewModel
    // after this we only use the id to reference elements and containers
    addDOMElement(element, container) {
        this[container].push( { 'id': element.getAttribute('id'), 'name': element.getAttribute('name') } );
    }

    // addDOMVoter
    // Accepts a DOMvoter and adds it to the relevant candidate in the viewModel
    // Similar to addDOMElement, but for voters (which are nested inside candidate player objects)
    addDOMVoter(DOMvoter, candidateId) {
        const candidate = this._findCandidate(candidateId);
        if (candidate) {
            if (! candidate['voters']) {
                candidate['voters'] = new Array;
                console.log('vm.addDOMVoter: voters array added', candidateId, candidate);
            }
            var child = this.removeElement(DOMvoter.getAttribute('id'));
            if (child) {
                console.log('vm.addDOMVoter: voter removed from previous parent', DOMvoter.getAttribute('id'), child);
                candidate['voters'].push( { 'id': DOMvoter.getAttribute('id'), 'name': DOMvoter.getAttribute('name') } );
            }
        }
    }

    getVoters(candidateId) {
        const candidate = this._findCandidate(candidateId);
        console.log('getVoters:', candidateId, candidate);
        if (candidate) {
            return candidate['voters'] || [];
        }
    }

        // removeAllVoters
    // Accepts a voter object and removes it from the viewModel candidates container
    removeAllVoters(candidateId) {
        const candidate = this._findCandidate(candidateId);
        if (candidate) {
            candidate['voters'] = [];
        }
    }

    // assignNewParent
    // Accepts a child DOM element and a new parent elementId and moves the child to the new parent
    // Locates the child's original parent, removes it from the old parent and adds it to the new parent
    // Also used when creating elements - so only remove if one is found
    // Function called when a child is added as a voter to a candidate - in this case the parent has no ID so we don't do anything (will already have happened via direct addDOMVoter or removeAllVoters)
    assignNewParent(DOMchild, newParentId) {
        if (newParentId) {
            var child = this.removeElement(DOMchild.getAttribute('id'));
            if (!child) {
                child = { 'id': DOMchild.getAttribute('id'), 'name': DOMchild.getAttribute('name') };
            }
            this[newParentId].push(child);
        }
    }

    // removeElement
    // Used when re-parenting to remove the element from the old parent
    // Accepts an element and removes it from the viewModel - returns the removed element
    removeElement(elementId) {
        for (let [key, value] of Object.entries(this)) {
            for (let i = 0; i < value.length; i++) {
                if (value[i].id == elementId) {
                    const removed = value.splice(i, 1);
                    return removed[0];
                }
            }
        }
        // If we get here, the element was not found - but it might be a voter 'hidden' inside the candidate list
        for (let c of this['candidates']) {
            if (c.voters) {
                for (let i = 0; i < c.voters.length; i++) {
                    if (c.voters[i].id == elementId) {
                        const removed = c.voters.splice(i, 1);
                        return removed[0];
                    }
                }    
            }
        }
        return null;
    }

    // PRIVATE METHODS
    _findCandidate(candidateId) {
        for (let c of this['candidates']) {
            if (c.id == candidateId) {
                return c;
            }
        }
        return null;
    }
 
}

export default viewModel;