import * as THREE from 'three'
import C from 'cannon'
import { pick } from './utils'

// Options
const force = 25



export default class Menu {

    constructor(scene, world, camera) {
        this.$navItems = document.querySelectorAll('.mainNav a')

        this.scene = scene
        this.world = world
        this.camera = camera

        this.loader = new THREE.FontLoader()
        this.clock = new THREE.Clock()

        // Setups
        this.totalMass = 1
        this.cMaterial = new C.Material()
        this.worldMat = new C.Material()

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
        this.offset = this.$navItems.length * this.margin * 0.5

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

        Array.from(this.$navItems).reverse().forEach(($item, i) => {
            const { innerText } = $item

            const words = new THREE.Group()
            words.len = 0

            words.ground = new C.Body({
                mass: 0,
                shape: new C.Box(new C.Vec3(50, 50, 0.1)),
                quaternion: new C.Quaternion().setFromEuler(Math.PI / -2, 0, 0),
                position: new C.Vec3(0, i * this.margin - this.offset, 0),
                material: this.worldMat,
            })

            words.isGroundDisplayed = false
            const randomColor = pick(colors)

            Array.from(innerText).forEach((letter, j) => {
                const progress = (j) / (innerText.length - 1)

                // Three.js
                const material = new THREE.MeshPhongMaterial({ color: randomColor.from.clone().lerp(randomColor.to, progress) })
                const geometry = new THREE.TextBufferGeometry(letter, options)

                geometry.computeBoundingBox()
                geometry.computeBoundingSphere()

                const mesh = new THREE.Mesh(geometry, material)

                // Get size
                mesh.size = mesh.geometry.boundingBox.getSize(new THREE.Vector3())
                mesh.size.multiply(new THREE.Vector3(0.5, 0.5, 0.5))

                // Cannon.js
                mesh.initPosition = new C.Vec3(words.len * 2, (this.$navItems.length - 1 - i) * this.margin - this.offset, 0)
                mesh.initPositionOffset = new C.Vec3(mesh.initPosition.x, mesh.initPosition.y + (i + 1) * 30 + 30 + j * 0.01, mesh.initPosition.z)

                words.len += mesh.size.x

                const box = new C.Box(new C.Vec3(mesh.size.x, mesh.size.y, mesh.size.z))

                mesh.body = new C.Body({
                    mass: this.totalMass / innerText.length,
                    position: mesh.initPositionOffset,
                    material: this.cMaterial,
                    // linearDamping: 0.1,
                    angularDamping: 0.99,
                })

                mesh.body.addShape(box, new C.Vec3(mesh.geometry.boundingSphere.center.x, mesh.geometry.boundingSphere.center.y, mesh.geometry.boundingSphere.center.z))

                this.world.addBody(mesh.body)
                words.add(mesh)
            })

            words.children.forEach((letter) => { letter.body.position.x -= words.len })

            this.words.push(words)
            this.scene.add(words)
        })

        const contactMat = new C.ContactMaterial(this.cMaterial, this.worldMat, {
            friction: 0.002,
            frictionEquationStiffness: 1e6,
            frictionEquationRelaxation: 3,
            restitution: 0.2,
            contactEquationStiffness: 1e20,
            contactEquationRelaxation: 3,
        })

        this.world.addContactMaterial(contactMat)

        this.setConstraints()
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
            const { object } = obj

            if (!object.isMesh) return

            const impulse = new THREE.Vector3().copy(obj.face.normal).negate().multiplyScalar(force)

            this.words.forEach((word, i) => {
                word.children.forEach((letter) => {
                    const { body } = letter

                    if (letter !== object) return

                    body.applyLocalImpulse(impulse, new C.Vec3())
                })


                setTimeout(() => {
                    this.world.removeBody(word.ground)
                }, 150 * (1 - this.clock.getDelta()) * (this.words.length + i))
            })
        }
    }


    /* Actions
    --------------------------------------------------------- */

    update() {
        if (!this.words) return

        this.words.forEach((word, j) => {
            for (let i = 0; i < word.children.length; i++) {
                const letter = word.children[i]

                letter.position.copy(letter.body.position)
                letter.quaternion.copy(letter.body.quaternion)

                if (j === this.words.length - 1 && letter.body.position.y <= -50) {
                    this.reset()
                }


                if (word.isGroundDisplayed) continue

                if (letter.body.position.y + letter.initPosition.y <= 0) {
                    this.world.addBody(word.ground)

                    word.isGroundDisplayed = true
                }
            }
        })
    }


    reset() {
        this.words.forEach((word) => {
            word.isGroundDisplayed = false

            const randomColor = pick(colors)

            for (let i = 0; i < word.children.length; i++) {
                const progress = (i) / (word.children.length - 1)

                const letter = word.children[i]
                letter.body.sleep()
                const { x, y, z } = letter.initPositionOffset

                letter.material.color = randomColor.from.clone().lerp(randomColor.to, progress)

                letter.material.needsUpdate = true

                letter.body.position.set(x - word.len, y, z)
                letter.body.quaternion.set(0, 0, 0, 1)

                letter.body.angularVelocity.setZero()
                letter.body.torque.setZero()
                letter.body.force.setZero()
                letter.body.wakeUp()
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
                    pivotA: new C.Vec3(letter.size.x, 0, 0),
                    pivotB: new C.Vec3(-letter.size.x, 0, 0),
                    axisA: C.Vec3.UNIT_X,
                    axisB: C.Vec3.UNIT_X,
                    angle: 0,
                    twistAngle: 0,
                    maxForce: 1e30,
                })

                c.collideConnected = true

                this.world.addConstraint(c)
            }
        })
    }

}




/* CONSTANTS & HELPERS
---------------------------------------------------------------------------------------------------- */

const fontURL = './dist/fonts/helvetiker_bold.typeface.json'
const colors = [
    {
        from : new THREE.Color('#ff699f'),
        to   : new THREE.Color('#a769ff'),
    },
    {
        from : new THREE.Color('#683fee'),
        to   : new THREE.Color('#527ee1'),
    },
    {
        from : new THREE.Color('#ee663f'),
        to   : new THREE.Color('#f5678d'),
    },
    {
        from : new THREE.Color('#ee9ca7'),
        to   : new THREE.Color('#ffdde1'),
    },
    {
        from : new THREE.Color('#f7971e'),
        to   : new THREE.Color('#ffd200'),
    },
    {
        from : new THREE.Color('#56ccf2'),
        to   : new THREE.Color('#2f80ed'),
    },
    {
        from : new THREE.Color('#fc5c7d'),
        to   : new THREE.Color('#6a82fb'),
    },
    {
        from : new THREE.Color('#dce35b'),
        to   : new THREE.Color('#45b649'),
    },
]
