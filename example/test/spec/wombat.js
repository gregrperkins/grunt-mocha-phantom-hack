describe('Wombat', function() {
    beforeEach(function() {
        this.wombat = new Wombat();
    });
    
    afterEach(function() {
        delete this.wombat;
    });
    
    it('should create a wombat with defaults', function() {
        expect(this.wombat).property('name', 'Wally');
    });
    
    it('should name itself if name passed in options', function() {
        // omfg matt the wombat is so cute.
        this.wombat = new Wombat({ name: 'Matt' });
        // throw new Error('sgt. grumbles');
        expect(this.wombat).property('name', 'Matt');
        // expect(this.wombat).property('name', 'Maaatt');
    });
    
    describe('#eat', function() {
        it('should throw if no food passed', function() {
            // throw new Error('foo');
            expect(this.wombat.eat).to.throw('D:');
        });
        
        it('should return noms if food passed', function() {
            expect(this.wombat.eat('apple')).to.eql('nom nom');
        });
    });
    
});
