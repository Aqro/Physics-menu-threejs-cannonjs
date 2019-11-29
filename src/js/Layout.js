
export default class Layout {

    constructor() {
        this.onResize()

        this.isMobile  = window.matchMedia('(max-width: 767px)').matches

        this.bindEvents()
    }

    bindEvents() {
        window.addEventListener('resize', () => { this.onResize() })
    }

    onResize() {
        this.W = window.innerWidth
        this.H = window.innerHeight
    }

}
