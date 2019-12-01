import * as THREE from 'three'
import C from 'cannon'

// Options
const force = 30


export default class Menu {

    constructor(scene, world, camera) {
        this.$navItems = document.querySelectorAll('.mainNav a')

        this.scene = scene
        this.world = world
        this.camera = camera

        this.loader = new THREE.FontLoader()

        // Setups
        this.totalMass = 1
        this.cMaterial = new C.Material()

        this.mouse = new THREE.Vector2()
        this.raycaster = new THREE.Raycaster()

        // Loader
        this.loader.load(fontURL, (f) => { this.setup(f) })

        this.bindEvents()
    }

    bindEvents() {
        document.addEventListener('click', () => { this.onClick() })
        window.addEventListener('mousemove', (e) => { this.onMouseMove(e) })
    }


    setup(font) {
        this.words = []
        this.margin = 6
        this.offset = this.$navItems.length * this.margin * 0.5 - 1

        const options = {
            font,
            size: 3,
            height: 0.4,
            curveSegments: 24,
            bevelEnabled: true,
            bevelThickness: 0.9,
            bevelSize: 0.3,
            bevelOffset: 0,
            bevelSegments: 10,
        }

        this.$navItems.forEach(($item, i) => {
            const { innerText } = $item

            const words = new THREE.Group()
            words.len = 0

            Array.from(innerText).forEach((letter, j) => {
                const progress = (j) / (innerText.length - 1)

                // Three.js
                const material = new THREE.MeshPhongMaterial({
                    color: colors[i].from.lerp(colors[i].to, progress),
                    shininess: 200,
                })
                const geometry = new THREE.TextBufferGeometry(letter, options)

                geometry.computeBoundingBox()
                geometry.computeBoundingSphere()

                const mesh = new THREE.Mesh(geometry, material)

                // Get size
                mesh.size = mesh.geometry.boundingBox.getSize(new THREE.Vector3())
                mesh.size.multiply(new THREE.Vector3(0.5, 0.5, 0.5))

                // Cannon.js
                mesh.initPosition = new C.Vec3(words.len * 2, (this.$navItems.length - 1 - i) * this.margin - this.offset, 0)

                words.len += mesh.size.x

                const box = new C.Box(new C.Vec3(mesh.size.x, mesh.size.y, mesh.size.z))

                mesh.body = new C.Body({
                    mass: this.totalMass / innerText.length,
                    position: mesh.initPosition,
                    material: this.cMaterial,
                })

                mesh.body.addShape(box, new C.Vec3(mesh.geometry.boundingSphere.center.x, mesh.geometry.boundingSphere.center.y, mesh.geometry.boundingSphere.center.z))

                this.world.addBody(mesh.body)
                words.add(mesh)
            })

            words.children.forEach((letter) => { letter.body.position.x -= words.len })

            this.words.push(words)
            this.scene.add(words)
        })

        this.setConstraints()
        this.addPivots()
    }


    /* Handlers
    --------------------------------------------------------- */


    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        this.raycaster.setFromCamera(this.mouse, this.camera)

        const intersects = this.raycaster.intersectObjects(this.scene.children, true)

        document.body.style.cursor = intersects.length > 0 ? 'pointer' : ''
    }

    onClick() {
        // update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera)

        // calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(this.scene.children, true)

        if (intersects.length > 0) {
            const obj = intersects[0]
            const { object, face } = obj

            if (!object.isMesh) return

            const impulse = new C.Vec3().copy(face.normal).scale(-force);

            this.words.forEach((word) => {
                word.children.forEach((letter) => {
                    const { body } = letter

                    if (letter !== object) return

                    body.applyLocalImpulse(impulse, new C.Vec3())
                })
            })
        }
    }


    /* Actions
    --------------------------------------------------------- */

    update() {
        if (!this.words) return

        this.words.forEach((word) => {
            for (let i = 0; i < word.children.length; i++) {
                const letter = word.children[i]

                letter.position.copy(letter.body.position)
                letter.quaternion.copy(letter.body.quaternion)
            }
        })
    }



    /* Values
    --------------------------------------------------------- */

    setConstraints() {
        this.words.forEach((word) => {
            for (let i = 0; i < word.children.length; i++) {
                const letter = word.children[i]
                const nextLetter = i + 1 === word.children.length ? null : word.children[i + 1]

                if (!nextLetter) continue

                const c = new C.ConeTwistConstraint(letter.body, nextLetter.body, {
                    pivotA: new C.Vec3(letter.size.x * 0.7, letter.size.y, 0),
                    pivotB: new C.Vec3(-letter.size.x * 0.7, letter.size.y, 0),
                    axisA: C.Vec3.UNIT_X,
                    axisB: C.Vec3.UNIT_X,
                    // maxForce: 1e2,
                    angle: 0,
                    twistAngle: 0,
                })
                c.collideConnected = true

                this.world.addConstraint(c)
            }
        })
    }

    addPivots() {
        this.words.forEach((word) => {
            const firstLetter = word.children[0]
            const lastLetter = word.children[word.children.length - 1]

            word.pA = new C.Body({
                mass: 0,
                position: new C.Vec3(
                    firstLetter.body.position.x - 2,
                    firstLetter.body.position.y + firstLetter.geometry.boundingSphere.center.y,
                    firstLetter.geometry.boundingSphere.center.z,
                ),
                shape: new C.Sphere(0.1),
            })

            word.pB = new C.Body({
                mass: 0,
                position: new C.Vec3(
                    lastLetter.body.position.x + lastLetter.size.x + 2.5,
                    lastLetter.body.position.y + lastLetter.geometry.boundingSphere.center.y,
                    lastLetter.geometry.boundingSphere.center.z,
                ),
                shape: new C.Sphere(0.1),
            })

            const cA = new C.ConeTwistConstraint(word.pA, firstLetter.body, {
                pivotA: new C.Vec3(2, 0.5, 0.5),
                pivotB: new C.Vec3(
                    0,
                    firstLetter.geometry.boundingSphere.center.y,
                    firstLetter.geometry.boundingSphere.center.z,
                ),
                axisA: C.Vec3.UNIT_X,
                axisB: C.Vec3.UNIT_X,
            })

            const cB = new C.ConeTwistConstraint(word.pB, lastLetter.body, {
                pivotA: new C.Vec3(-lastLetter.size.x - 2.5, 0.5, 0.5),
                pivotB: new C.Vec3(
                    0,
                    lastLetter.geometry.boundingSphere.center.y,
                    lastLetter.geometry.boundingSphere.center.z,
                ),
                axisA: C.Vec3.UNIT_X,
                axisB: C.Vec3.UNIT_X,
            })

            this.world.addConstraint(cA)
            this.world.addConstraint(cB)

            this.world.addBody(word.pA)
            this.world.addBody(word.pB)
        })
    }

}




/* CONSTANTS & HELPERS
---------------------------------------------------------------------------------------------------- */

const fontURL = './dist/fonts/helvetiker_bold.typeface.json'
const colors = [
    {
        from : new THREE.Color('#DF872D'),
        to   : new THREE.Color('#B35E07'),
    },
    {
        from : new THREE.Color('#e2ad76'),
        to   : new THREE.Color('#bb7d6e'),
    },
    {
        from : new THREE.Color('#5d3d42'),
        to   : new THREE.Color('#5d2d29'),
    },
]
