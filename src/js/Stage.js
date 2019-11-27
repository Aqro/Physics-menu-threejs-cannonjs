import Scene from './Scene'

export default class Stage {

    constructor() {
        this.$els = {
            scene       : document.getElementById('scene'),
        }


        this.init()

        this.bindEvents()
    }

    bindEvents() {
        //
    }

    init() {
        this.scene = new Scene()
    }


    /* Handlers
    --------------------------------------------------------- */



    /* Actions
    --------------------------------------------------------- */



    /* Values
    --------------------------------------------------------- */


}
