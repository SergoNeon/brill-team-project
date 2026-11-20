// BRILL native SA-MP 0.3.DL-R1 transport, consumed by Android JNI.
// Upstream protocol transport is Apache-2.0; see THIRD_PARTY_APACHE_2_LICENSE.txt.
package main

/*
#include <stdint.h>
#include <stdlib.h>
*/
import "C"

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"sync"
	"time"
	"unsafe"

	"brill.city/multiplayer/clientcore/internal/domain"
	"brill.city/multiplayer/clientcore/internal/samp"
)

var (
	mu            sync.Mutex
	current       *samp.Client
	currentCancel context.CancelFunc
	state         = "Отключено"
	events        = make([]string, 0, 128)
	nickRE        = regexp.MustCompile(`^[A-Za-z0-9_]{3,24}$`)
)

func addEvent(v interface{}) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	if len(events) >= 128 {
		events = events[1:]
	}
	events = append(events, string(b))
}
func setState(s string) { mu.Lock(); state = s; mu.Unlock() }
func validAddress(addr string) bool {
	host, portText, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	if ip == nil || ip.To4() == nil {
		return false
	}
	port, err := strconv.Atoi(portText)
	return err == nil && port > 0 && port <= 65535
}

//export BrillStart
func BrillStart(address, nickname *C.char) C.int {
	if address == nil || nickname == nil {
		return -1
	}
	addr := C.GoString(address)
	nick := C.GoString(nickname)
	if !validAddress(addr) || !nickRE.MatchString(nick) {
		return -2
	}
	mu.Lock()
	if current != nil {
		mu.Unlock()
		return -3
	}
	state = "Соединение"
	events = events[:0]
	mu.Unlock()
	// Use a lifetime context for the whole game session. Only the RakNet
	// handshake is bounded to 12 seconds, otherwise long-playing sessions
	// would disconnect exactly 12 seconds after joining.
	ctx, cancel := context.WithCancel(context.Background())
	type dialResult struct {
		client *samp.Client
		err    error
	}
	done := make(chan dialResult, 1)
	go func() {
		c, err := samp.DialClientWithOptions(ctx, addr, nick, "", "Windows-1251", samp.ClientOptions{Version: domain.Version03DLR1, RespawnPolicy: samp.RespawnPolicyManual})
		done <- dialResult{client: c, err: err}
	}()
	var client *samp.Client
	var err error
	select {
	case result := <-done:
		client, err = result.client, result.err
	case <-time.After(12 * time.Second):
		cancel()
		setState("Тайм-аут подключения")
		addEvent(map[string]string{"type": "error", "message": "RakNet handshake timeout"})
		return -4
	}
	if err != nil {
		cancel()
		setState("Ошибка подключения")
		addEvent(map[string]interface{}{"type": "error", "message": err.Error()})
		return -4
	}
	mu.Lock()
	current = client
	currentCancel = cancel
	state = "RakNet: соединено"
	mu.Unlock()
	addEvent(map[string]interface{}{"type": "transport.connected", "version": "0.3.DL-R1"})
	go func() {
		defer func() {
			mu.Lock()
			if current == client {
				current = nil
				currentCancel = nil
				state = "Отключено"
			}
			mu.Unlock()
			client.Close()
			cancel()
		}()
		for ev := range client.Events() {
			addEvent(map[string]interface{}{"type": string(ev.Type), "data": ev.Data})
			if ev.Type == samp.EventJoined {
				setState("SA-MP: подключено")
			}
			if ev.Type == samp.EventProtocolError || ev.Type == samp.EventDisconnected {
				break
			}
		}
	}()
	return 0
}

//export BrillStop
func BrillStop() {
	mu.Lock()
	c := current
	cancel := currentCancel
	current = nil
	currentCancel = nil
	state = "Отключено"
	mu.Unlock()
	if c != nil {
		_ = c.Close()
	}
	if cancel != nil {
		cancel()
	}
}

//export BrillState
func BrillState() *C.char { mu.Lock(); s := state; mu.Unlock(); return C.CString(s) }

//export BrillNextEvent
func BrillNextEvent() *C.char {
	mu.Lock()
	defer mu.Unlock()
	if len(events) == 0 {
		return C.CString("")
	}
	s := events[0]
	events = events[1:]
	return C.CString(s)
}

//export BrillCommand
func BrillCommand(cmd *C.char) C.int {
	if cmd == nil {
		return -1
	}
	mu.Lock()
	c := current
	mu.Unlock()
	if c == nil {
		return -2
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := c.SendCommand(ctx, C.GoString(cmd)); err != nil {
		addEvent(map[string]string{"type": "error", "message": err.Error()})
		return -3
	}
	return 0
}

//export BrillChat
func BrillChat(text *C.char) C.int {
	if text == nil {
		return -1
	}
	mu.Lock()
	c := current
	mu.Unlock()
	if c == nil {
		return -2
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := c.SendChat(ctx, C.GoString(text)); err != nil {
		addEvent(map[string]string{"type": "error", "message": err.Error()})
		return -3
	}
	return 0
}

//export BrillRespondDialog
func BrillRespondDialog(id C.short, button C.uchar, item C.short, input *C.char) C.int {
	mu.Lock()
	c := current
	mu.Unlock()
	if c == nil {
		return -2
	}
	val := ""
	if input != nil {
		val = C.GoString(input)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := c.RespondDialog(ctx, int16(id), uint8(button), int16(item), val); err != nil {
		addEvent(map[string]string{"type": "error", "message": err.Error()})
		return -3
	}
	return 0
}

//export BrillRelease
func BrillRelease(s *C.char) {
	if s != nil {
		C.free(unsafe.Pointer(s))
	}
}

func main() { fmt.Println("BRILL 0.3.DL-R1 protocol shared library") }