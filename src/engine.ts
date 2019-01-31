// ---------------------------------------
//          Global Configuration
// ---------------------------------------

const fps = 30
const cpuspeed = 240
const width = 64
const height = 32
const screenWidth = 640
const screenHeight = 320
const videomemLength = width * height
const ramLength = 4096

const xScale = screenWidth / width
const yScale = screenHeight / height

// ---------------------------------------
//              Canvas Magic
// ---------------------------------------

const scanvas = <HTMLCanvasElement> document.getElementById('maincanvas')
const dcanvas = <HTMLCanvasElement> document.createElement('canvas')

const sctx = scanvas.getContext('2d')
const dctx = dcanvas.getContext('2d')

dcanvas.width = width
dcanvas.height = height
sctx.scale(xScale, yScale)
sctx.imageSmoothingEnabled = false

const image = dctx.createImageData(width, height)
const videobuffer = new DataView(image.data.buffer)
const videomem = new Uint8Array(videomemLength)

// ---------------------------------------
//              Memory Layout
// ---------------------------------------

const mem = new Uint8Array(ramLength)
const reg = new Uint8Array(16)
const stack = new Uint16Array(16)
const keys = new Uint8Array(16)

let I = 0
let PC = 0
let SP = 0
let DT = 0
let ST = 0

// ---------------------------------------
//              Video Update
// ---------------------------------------

function refresh() {
    requestAnimationFrame(refresh)

    for (let i = 0, j = 0; i < videomem.length; i += 1, j += 4) {
        const dst = (videomem[i] != 0) ? 0x88ba6aFF : 0x446b2cFF // palette[videomem[i]]
        videobuffer.setUint32(j, dst)        
    }

    dctx.putImageData(image, 0, 0)
    sctx.drawImage(dcanvas, 0, 0)
}

function pset(x: number, y: number, col: number) {
    videomem[y * width + x] = col 
}

function pget(x: number, y: number) {
    return videomem[y * width + x]
}

function clearScreen() {
    
}

function drawSprite(sprAddr: number, x0: number, y0: number, height: number) {
    let collision = 0

    for (let y = 0; y < height; y += 1) {
        let sprite = mem[I + y]
        for (let x = 0; x < 8; x += 1) {
            if ((sprite & (0x80 >> x)) != 0) {
                const p = pget(x0 + x, y0 + y)
                if (p !== 0) collision = 1
                pset(x0 + x, y0 + y, p ^ 1)
            }
        } 
    }

    return collision
}

// ---------------------------------------
//            Emulator updates
// ---------------------------------------

// ---------------------------------------
//                  ROM
// ---------------------------------------

function initialize() {
    I  = 0      // Index register
    SP = 0      // Stack Pointer
    PC = 0x200  // Program Counter
    DT = 0      // Delay Timer
    ST = 0      // Sound Timer

    const hexChars = [
        0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
        0x20, 0x60, 0x20, 0x20, 0x70, // 1
        0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
        0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
        0x90, 0x90, 0xF0, 0x10, 0x10, // 4
        0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
        0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
        0xF0, 0x10, 0x20, 0x40, 0x40, // 7
        0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
        0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
        0xF0, 0x90, 0xF0, 0x90, 0x90, // A
        0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
        0xF0, 0x80, 0x80, 0x80, 0xF0, // C
        0xE0, 0x90, 0x90, 0x90, 0xE0, // D
        0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
        0xF0, 0x80, 0xF0, 0x80, 0x80  // F
    ]

    mem.set(hexChars, 0x00)
}

function load(program: ArrayLike<number>, baseAddress = 0x200) {
    mem.set(program, baseAddress)
}

function handleTimers() {
    if (DT > 0) DT -= 1
    if (ST > 0) ST -= 1
}

function overflow(val) {
    return (val > 255) ? val - 256 : val
}

function stepFor(n = 1) {
    while (n > 0) { step(); n -= 1 }
}

function disassemble(opcode: number) {
    const a = opcode & 0x0FFF
    const b = opcode & 0x00FF
    const n = opcode & 0x000F
    const x = opcode >> 8 & 0xF
    const y = opcode >> 4 & 0xF
    
    const op = opcode.toString(16)
    const aa = a.toString(16)
    const bb = b.toString(16)
    const nn = n.toString(16)
    const xx = x.toString(16)
    const yy = y.toString(16)

    switch (opcode & 0xF000) {
        case 0x0000: switch (b) {
          case 0xE0: return 'CLS' 
          case 0xEE: return 'RET'
            default: return `0x${op}` }
        case 0x1000: return `JP ${a}`
        case 0x2000: return `CALL ${a}`
        case 0x3000: return `SE V${x}, ${b}`
        case 0x4000: return `SNE V${x}, ${b}`
        case 0x6000: return `LD V${x}, ${b}`
        case 0x7000: return `ADD V${x}, ${b}`
        case 0x8000: switch (n) {
           case 0x0: return `LD V${x}, V${y}`
           case 0x1: return `OR V${x}, V${y}`
           case 0x2: return `AND V${x}, V${y}`
           case 0x3: return `XOR V${x}, V${y}`
           case 0x4: return `ADD V${x}, V${y}`
           case 0x5: return `SUB V${x}, V${y}`
           case 0x6: return `SHR V${x}, V${y}`
           case 0xE: return `SHL V${x}, V${y}`
            default: return `0x${op}` }
        case 0xA000: return `LD I, ${a}`
        case 0xC000: return `RND V${x}, ${b}`
        case 0xD000: return `DRW V${x}, V${y}, ${n}`
        case 0xE000: switch (b) {
          case 0x9E: return `SKP V${x}`
          case 0xA1: return `SKNP V${x}`
            default: return `0x${op}` }
        case 0xF000: switch (b) {
          case 0x07: return `LD V${x}, DT`
          case 0x15: return `LD DT, V${x}`
          case 0x18: return `LD ST, V${x}`
          case 0x29: return `LD F, V${x}`
          case 0x33: return `LD B, V${x}`
          case 0x55: return `LD [I], V${x}`                
          case 0x65: return `LD V${x}, [I]`
            default: return `0x${op}` }
        default:
            return `0x${op}`
    }
}

function step() {
    // Fetch Opcode
    const opcode = mem[PC] << 8 | mem[PC + 1]
    console.log(disassemble(opcode))

    // Advance PC
    PC += 2

    // Decode transient registers
    const decode = opcode & 0xF000
    const a = opcode & 0x0FFF
    const b = opcode & 0x00FF
    const n = opcode & 0x000F
    const x = opcode >> 8 & 0xF
    const y = opcode >> 4 & 0xF

    // Execute
    switch(decode) {
        case 0x0000:
            switch (b) {
                case 0xE0:
                    clearScreen()
                    break
                case 0xEE:
                    SP -= 1
                    PC = stack[SP]
                    break
            }
            break
        case 0x1000:
            PC = a
            break
        case 0x2000: 
            stack[SP] = PC
            SP += 1
            PC = a
            break
        case 0x3000:
            if (reg[x] === b) PC += 2
            break
        case 0x4000:
            if (reg[x] !== b) PC += 2
            break
        case 0x6000:
            reg[x] = b            
            break
        case 0x7000:
            reg[x] = overflow(reg[x] + b)
            break
        case 0x8000:
            switch(n) {
                case 0x0: console.debug(`LD V${x}, V${y}`); reg[x] = reg[y]; break
                case 0x1: console.debug(`OR V${x}, V${y}`); reg[x] |= reg[y]; break
                case 0x2: console.debug(`AND V${x}, V${y}`); reg[x] &= reg[y]; break
                case 0x3: console.debug(`XOR V${x}, V${y}`); reg[x] ^= reg[y]; break
                case 0x4: console.debug(`ADD V${x}, V${y}`); reg[x] = overflow(reg[x] + reg[y]); break // TODO carry
                case 0x5: console.debug(`SUB V${x}, V${y}`); reg[x] = overflow(reg[x] - reg[y]); break // TODO borrow
                case 0x6: console.debug(`SHR V${x}, V${y}`); reg[x] >>= 1; break // TODO flags
                case 0xE: console.debug(`SHL V${x}, V${y}`); reg[x] <<= 1; break // TODO flags
            }
            break
        case 0xA000:
            I = a
            break
        case 0xC000:
            // Sets VX to the result of a bitwise and operation on a random number (Typically: 0 to 255) and NN.
            reg[x] = Math.floor(Math.random() * 0xFF) & b
            break
        case 0xD000:
            // Display n-byte sprite starting at memory location I at (Vx, Vy), set VF equal to collision.
            reg[0xF] = drawSprite(I, reg[x], reg[y], n)
            break
        case 0xE000:
            switch(b) {
                case 0x9E: if (keys[x]) PC += 2; break
                case 0xA1: if (!keys[x]) PC += 2; break
            }
            break
        case 0xF000:
            switch(b) {
                case 0x07:
                    // Place value of DT in Vx
                    reg[x] = DT
                    break
                case 0x15:
                    // Place value of Vx in DT
                    DT = reg[x]
                    break
                case 0x18:
                    // Place value of Vx in ST
                    ST = reg[x]
                    break
                case 0x29:
                    // Sets I to the location of the sprite for the character in VX. 
                    // Characters 0-F (in hexadecimal) are represented by a 4x5 font.
                    I = reg[x] * 5
                    break
                case 0x33:
                    // Stores the binary-coded decimal representation of VX, with the most significant of three digits 
                    // at the address in I, the middle digit at I plus 1, and the least significant digit at I plus 2. 
                    // (In other words, take the decimal representation of VX, place the hundreds digit in memory at 
                    // location in I, the tens digit at location I+1, and the ones digit at location I+2.)
                    mem[I + 0] = Math.round(reg[x] / 100)
                    mem[I + 1] = Math.round(reg[x] / 10) % 10 
                    mem[I + 2] = reg[x] % 10
                    break
                case 0x55:
                    mem.set(reg.slice(0, x), I)
                    break
                case 0x65:
                    reg.set(mem.slice(I, I + x))
                    break;
            }
            break
    }

    // Update timers
}

function printStatus() {
    console.debug({
        'PC': PC,
        'SP': SP,
        'V': reg,
        'Stack': stack
    })
}

// ---------------------------------------
//           Temporary Example
// ---------------------------------------

const rom = [
    0x22, 0xfc, 0x6b, 0x0c, 0x6c, 0x3f, 0x6d, 0x0c, 0xa2, 0xea, 0xda, 0xb6, 0xdc, 0xd6, 0x6e, 0x00,
    0x22, 0xd4, 0x66, 0x03, 0x68, 0x02, 0x60, 0x60, 0xf0, 0x15, 0xf0, 0x07, 0x30, 0x00, 0x12, 0x1a,
    0xc7, 0x17, 0x77, 0x08, 0x69, 0xff, 0xa2, 0xf0, 0xd6, 0x71, 0xa2, 0xea, 0xda, 0xb6, 0xdc, 0xd6,
    0x60, 0x01, 0xe0, 0xa1, 0x7b, 0xfe, 0x60, 0x04, 0xe0, 0xa1, 0x7b, 0x02, 0x60, 0x1f, 0x8b, 0x02,
    0xda, 0xb6, 0x60, 0x0c, 0xe0, 0xa1, 0x7d, 0xfe, 0x60, 0x0d, 0xe0, 0xa1, 0x7d, 0x02, 0x60, 0x1f,
    0x8d, 0x02, 0xdc, 0xd6, 0xa2, 0xf0, 0xd6, 0x71, 0x86, 0x84, 0x87, 0x94, 0x60, 0x3f, 0x86, 0x02,
    0x61, 0x1f, 0x87, 0x12, 0x46, 0x00, 0x12, 0x78, 0x46, 0x3f, 0x12, 0x82, 0x47, 0x1f, 0x69, 0xff,
    0x47, 0x00, 0x69, 0x01, 0xd6, 0x71, 0x12, 0x2a, 0x68, 0x02, 0x63, 0x01, 0x80, 0x70, 0x80, 0xb5,
    0x12, 0x8a, 0x68, 0xfe, 0x63, 0x0a, 0x80, 0x70, 0x80, 0xd5, 0x3f, 0x01, 0x12, 0xa2, 0x61, 0x02,
    0x80, 0x15, 0x3f, 0x01, 0x12, 0xba, 0x80, 0x15, 0x3f, 0x01, 0x12, 0xc8, 0x80, 0x15, 0x3f, 0x01,
    0x12, 0xc2, 0x60, 0x20, 0xf0, 0x18, 0x22, 0xd4, 0x8e, 0x34, 0x22, 0xd4, 0x66, 0x3e, 0x33, 0x01,
    0x66, 0x03, 0x68, 0xfe, 0x33, 0x01, 0x68, 0x02, 0x12, 0x16, 0x79, 0xff, 0x49, 0xfe, 0x69, 0xff,
    0x12, 0xc8, 0x79, 0x01, 0x49, 0x02, 0x69, 0x01, 0x60, 0x04, 0xf0, 0x18, 0x76, 0x01, 0x46, 0x40,
    0x76, 0xfe, 0x12, 0x6c, 0xa2, 0xf2, 0xfe, 0x33, 0xf2, 0x65, 0xf1, 0x29, 0x64, 0x14, 0x65, 0x02,
    0xd4, 0x55, 0x74, 0x15, 0xf2, 0x29, 0xd4, 0x55, 0x00, 0xee, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
    0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0xc0, 0xc0, 0x00, 0xff, 0x00, 0x6b, 0x20, 0x6c, 0x00,
    0xa2, 0xf6, 0xdb, 0xc4, 0x7c, 0x04, 0x3c, 0x20, 0x13, 0x02, 0x6a, 0x00, 0x6b, 0x00, 0x6c, 0x1f,
    0xa2, 0xfa, 0xda, 0xb1, 0xda, 0xc1, 0x7a, 0x08, 0x3a, 0x40, 0x13, 0x12, 0xa2, 0xf6, 0x6a, 0x00,
    0x6b, 0x20, 0xdb, 0xa1, 0x00, 0xee
]

refresh()
initialize()
load(rom)

window.setInterval(() => handleTimers(), 1000 / (fps * 4))
window.setInterval(() => step(), 1000 / cpuspeed)
