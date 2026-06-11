import { parseSyllabusWithFallback } from "../lib/syllabus-parser.ts";

const sample = `
For the Batches admitted in 2021-22
24 (R-21)
Scheme of Instruction
MVSREC Information Technology
Course Code Course Title Core/elective
U21PC603IT Computer Networks
UNIT-II
Internetworking: Concatenated virtual circuits, Connectionless internetworking, Tunneling, Fragmentation
Network layer in the Internet: IP protocol, IP addresses, IPv6, Internet control protocols, OSPF, BGP
UNIT-III
Network Programming: Sockets, Socket Address, Elementary Sockets, Advanced Sockets, Socket Options
UNIT-IV
Transport Layer: Transport service primitives, Addressing, Connection Establishment
Internet Transport Protocols (UDP and TCP): Introduction to UDP, The TCP protocol, TCP Congestion Control
UNIT-V
Application Layer: Domain Name System, Electronic Mail, World Wide Web, HTTP
Text Books:
1. Computer Networks by Tanenbaum
`;

const result = parseSyllabusWithFallback(sample);
console.log(JSON.stringify(result, null, 2));
