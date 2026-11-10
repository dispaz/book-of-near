;; Book of NEAR counter: the test contract behind `runChainContract` and the demo "counter".
;; Hand-written WebAssembly text, so it builds with `npm run build:counter` (wabt, no Rust needed)
;; and stays tiny (under 2 KB, so deploying it costs almost no storage).
;;
;; Methods (same as demoContractCode("counter") in src/chain/demo/contracts.ts):
;;   increment({ by = 1 })            adds `by`, logs "Count is now N", returns N
;;   get_num()                        view: the count
;;   fail()                           always panics
;;   call_other({ account_id, method_name = "increment" })
;;                                    calls method_name on account_id, then on_other_done here
;;   on_other_done()                  private callback: stores "ok" or "failed", returns true/false
;;   last_result()                    view: "ok", "failed" or null
;;   reset()                          deletes "num" and "last_result" from storage (lesson 3.1)
;;
;; Only WebAssembly MVP instructions (no bulk memory, no sign extension): NEAR rejects newer ones.
;; Host functions: https://github.com/near/nearcore/blob/master/runtime/near-vm-runner/src/logic/logic.rs
(module
  (import "env" "input" (func $input (param i64)))
  (import "env" "register_len" (func $register_len (param i64) (result i64)))
  (import "env" "read_register" (func $read_register (param i64 i64)))
  (import "env" "value_return" (func $value_return (param i64 i64)))
  (import "env" "log_utf8" (func $log_utf8 (param i64 i64)))
  (import "env" "panic_utf8" (func $panic_utf8 (param i64 i64)))
  (import "env" "storage_write" (func $storage_write (param i64 i64 i64 i64 i64) (result i64)))
  (import "env" "storage_read" (func $storage_read (param i64 i64 i64) (result i64)))
  (import "env" "storage_remove" (func $storage_remove (param i64 i64 i64) (result i64)))
  (import "env" "current_account_id" (func $current_account_id (param i64)))
  (import "env" "predecessor_account_id" (func $predecessor_account_id (param i64)))
  (import "env" "promise_create"
    (func $promise_create (param i64 i64 i64 i64 i64 i64 i64 i64) (result i64)))
  (import "env" "promise_then"
    (func $promise_then (param i64 i64 i64 i64 i64 i64 i64 i64 i64) (result i64)))
  (import "env" "promise_results_count" (func $promise_results_count (result i64)))
  (import "env" "promise_result" (func $promise_result (param i64 i64) (result i64)))
  (import "env" "promise_return" (func $promise_return (param i64)))

  (memory 2)
  (export "memory" (memory 0))

  ;; Constants. Offsets are used below as plain numbers.
  (data (i32.const 0) "num")                       ;; 3
  (data (i32.const 8) "last_result")               ;; 11
  (data (i32.const 24) "\22ok\22")                 ;; 4
  (data (i32.const 32) "\22failed\22")             ;; 8
  (data (i32.const 48) "null")                     ;; 4
  (data (i32.const 56) "true")                     ;; 4
  (data (i32.const 64) "false")                    ;; 5
  (data (i32.const 80) "This method always fails") ;; 24
  (data (i32.const 112) "Only the contract itself may call this") ;; 38
  (data (i32.const 160) "Count is now ")           ;; 13
  (data (i32.const 176) "Calling ")                ;; 8
  (data (i32.const 184) " on ")                    ;; 4
  (data (i32.const 192) "The other call worked")   ;; 21
  (data (i32.const 224) "The other call failed, so nothing changed there") ;; 47
  (data (i32.const 280) "{}")                      ;; 2
  (data (i32.const 288) "on_other_done")           ;; 13
  (data (i32.const 304) "\22by\22")                ;; 4
  (data (i32.const 312) "\22account_id\22")        ;; 12
  (data (i32.const 328) "\22method_name\22")       ;; 13
  (data (i32.const 344) "increment")               ;; 9
  (data (i32.const 360) "Bad arguments: expected account_id") ;; 34
  (data (i32.const 432) "State cleared")           ;; 13
  ;; 400..416: a u128 zero (attached deposit for promises), left zeroed.

  ;; Buffers.
  ;; 1024: storage value of "num" (8 bytes, little-endian u64)
  ;; 2048: output scratch (logs, numbers), up to 4096 bytes
  ;; 8192: current account id, 8448: predecessor id (64 bytes max each)
  ;; 16384: input, up to 100000 bytes

  (global $GAS_20 i64 (i64.const 20000000000000))

  ;; ---------- helpers ----------

  (func $p (param $x i32) (result i64) (i64.extend_i32_u (local.get $x)))

  (func $copy (param $dst i32) (param $src i32) (param $len i32) (result i32)
    ;; byte copy; returns dst + len
    (block $done
      (loop $next
        (br_if $done (i32.eqz (local.get $len)))
        (i32.store8 (local.get $dst) (i32.load8_u (local.get $src)))
        (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
        (local.set $src (i32.add (local.get $src) (i32.const 1)))
        (local.set $len (i32.sub (local.get $len) (i32.const 1)))
        (br $next)))
    (local.get $dst))

  (func $eq (param $a i32) (param $b i32) (param $len i32) (result i32)
    (block $no
      (loop $next
        (if (i32.eqz (local.get $len)) (then (return (i32.const 1))))
        (br_if $no (i32.ne (i32.load8_u (local.get $a)) (i32.load8_u (local.get $b))))
        (local.set $a (i32.add (local.get $a) (i32.const 1)))
        (local.set $b (i32.add (local.get $b) (i32.const 1)))
        (local.set $len (i32.sub (local.get $len) (i32.const 1)))
        (br $next)))
    (i32.const 0))

  ;; Read the call's JSON arguments to 16384. Returns their length.
  (func $read_input (result i32)
    (local $len i64)
    (call $input (i64.const 0))
    (local.set $len (call $register_len (i64.const 0)))
    (if (i64.eq (local.get $len) (i64.const -1)) (then (return (i32.const 0))))
    (if (i64.gt_u (local.get $len) (i64.const 100000))
      (then (call $panic_utf8 (i64.const 34) (i64.const 360)) (unreachable)))
    (call $read_register (i64.const 0) (i64.const 16384))
    (i32.wrap_i64 (local.get $len)))

  ;; Position just after `needle` in the input, past spaces and a colon; -1 when absent.
  (func $find_key (param $end i32) (param $needle i32) (param $nlen i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 16384))
    (block $missing
      (loop $scan
        (br_if $missing (i32.gt_u (i32.add (local.get $i) (local.get $nlen)) (local.get $end)))
        (if (call $eq (local.get $i) (local.get $needle) (local.get $nlen))
          (then
            (local.set $i (i32.add (local.get $i) (local.get $nlen)))
            (block $stop
              (loop $skip
                (br_if $stop (i32.ge_u (local.get $i) (local.get $end)))
                (br_if $stop
                  (i32.and
                    (i32.ne (i32.load8_u (local.get $i)) (i32.const 32))
                    (i32.ne (i32.load8_u (local.get $i)) (i32.const 58))))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $skip)))
            (return (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (i32.const -1))

  ;; Unsigned decimal at $pos (stops at the first non-digit).
  (func $parse_u64 (param $pos i32) (param $end i32) (result i64)
    (local $n i64) (local $c i32)
    (block $stop
      (loop $digit
        (br_if $stop (i32.ge_u (local.get $pos) (local.get $end)))
        (local.set $c (i32.sub (i32.load8_u (local.get $pos)) (i32.const 48)))
        (br_if $stop (i32.gt_u (local.get $c) (i32.const 9)))
        (local.set $n
          (i64.add (i64.mul (local.get $n) (i64.const 10)) (i64.extend_i32_u (local.get $c))))
        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
        (br $digit)))
    (local.get $n))

  ;; A JSON string value at $pos ("..."); returns its length and stores its start in $str_at.
  (global $str_at (mut i32) (i32.const 0))
  (func $string_at (param $pos i32) (param $end i32) (result i32)
    (local $i i32)
    (if (i32.or (i32.lt_s (local.get $pos) (i32.const 0)) (i32.ge_u (local.get $pos) (local.get $end)))
      (then (return (i32.const -1))))
    (if (i32.ne (i32.load8_u (local.get $pos)) (i32.const 34)) (then (return (i32.const -1))))
    (local.set $i (i32.add (local.get $pos) (i32.const 1)))
    (global.set $str_at (local.get $i))
    (block $stop
      (loop $ch
        (if (i32.ge_u (local.get $i) (local.get $end)) (then (return (i32.const -1))))
        (br_if $stop (i32.eq (i32.load8_u (local.get $i)) (i32.const 34)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $ch)))
    (i32.sub (local.get $i) (global.get $str_at)))

  ;; Write $v in decimal at $dst; returns the end pointer.
  (func $write_u64 (param $dst i32) (param $v i64) (result i32)
    (local $tmp i32) (local $len i32)
    ;; digits backwards into 3072.., then copy forwards
    (local.set $tmp (i32.const 3100))
    (loop $d
      (local.set $tmp (i32.sub (local.get $tmp) (i32.const 1)))
      (i32.store8 (local.get $tmp)
        (i32.add (i32.const 48) (i32.wrap_i64 (i64.rem_u (local.get $v) (i64.const 10)))))
      (local.set $v (i64.div_u (local.get $v) (i64.const 10)))
      (br_if $d (i64.ne (local.get $v) (i64.const 0))))
    (local.set $len (i32.sub (i32.const 3100) (local.get $tmp)))
    (call $copy (local.get $dst) (local.get $tmp) (local.get $len)))

  (func $get_count (result i64)
    (if (i64.eq (call $storage_read (i64.const 3) (i64.const 0) (i64.const 1)) (i64.const 1))
      (then
        (call $read_register (i64.const 1) (i64.const 1024))
        (return (i64.load (i32.const 1024)))))
    (i64.const 0))

  (func $return_u64 (param $v i64)
    (local $end i32)
    (local.set $end (call $write_u64 (i32.const 2048) (local.get $v)))
    (call $value_return (call $p (i32.sub (local.get $end) (i32.const 2048))) (i64.const 2048)))

  (func $log (param $start i32) (param $end i32)
    (call $log_utf8 (call $p (i32.sub (local.get $end) (local.get $start))) (call $p (local.get $start))))

  ;; ---------- methods ----------

  (func (export "increment")
    (local $end i32) (local $at i32) (local $by i64) (local $n i64) (local $out i32)
    (local.set $end (i32.add (i32.const 16384) (call $read_input)))
    (local.set $by (i64.const 1))
    (local.set $at (call $find_key (local.get $end) (i32.const 304) (i32.const 4)))
    (if (i32.ge_s (local.get $at) (i32.const 0))
      (then (local.set $by (call $parse_u64 (local.get $at) (local.get $end)))))
    (local.set $n (i64.add (call $get_count) (local.get $by)))
    (i64.store (i32.const 1024) (local.get $n))
    (drop (call $storage_write (i64.const 3) (i64.const 0) (i64.const 8) (i64.const 1024) (i64.const 2)))
    (local.set $out (call $copy (i32.const 2048) (i32.const 160) (i32.const 13)))
    (local.set $out (call $write_u64 (local.get $out) (local.get $n)))
    (call $log (i32.const 2048) (local.get $out))
    (call $return_u64 (local.get $n)))

  (func (export "get_num")
    (call $return_u64 (call $get_count)))

  (func (export "fail")
    (call $panic_utf8 (i64.const 24) (i64.const 80)))

  (func (export "last_result")
    (if (i64.eq (call $storage_read (i64.const 11) (i64.const 8) (i64.const 1)) (i64.const 1))
      (then
        (call $read_register (i64.const 1) (i64.const 2048))
        (call $value_return (call $register_len (i64.const 1)) (i64.const 2048)))
      (else (call $value_return (i64.const 4) (i64.const 48)))))

  ;; Deletes the count and the last result. Freed bytes no longer need storage staking.
  (func (export "reset")
    (drop (call $storage_remove (i64.const 3) (i64.const 0) (i64.const 1)))
    (drop (call $storage_remove (i64.const 11) (i64.const 8) (i64.const 1)))
    (call $log_utf8 (i64.const 13) (i64.const 432)))

  (func (export "call_other")
    (local $end i32) (local $acc i32) (local $acc_len i32) (local $m i32) (local $m_len i32)
    (local $out i32) (local $promise i64) (local $self_len i64)
    (local.set $end (i32.add (i32.const 16384) (call $read_input)))
    (local.set $acc_len
      (call $string_at (call $find_key (local.get $end) (i32.const 312) (i32.const 12)) (local.get $end)))
    (local.set $acc (global.get $str_at))
    (if (i32.or (i32.lt_s (local.get $acc_len) (i32.const 2)) (i32.gt_s (local.get $acc_len) (i32.const 64)))
      (then (call $panic_utf8 (i64.const 34) (i64.const 360)) (unreachable)))
    (local.set $m_len
      (call $string_at (call $find_key (local.get $end) (i32.const 328) (i32.const 13)) (local.get $end)))
    (local.set $m (global.get $str_at))
    (if (i32.or (i32.lt_s (local.get $m_len) (i32.const 1)) (i32.gt_s (local.get $m_len) (i32.const 256)))
      (then (local.set $m (i32.const 344)) (local.set $m_len (i32.const 9))))
    ;; log "Calling <method> on <account>"
    (local.set $out (call $copy (i32.const 2048) (i32.const 176) (i32.const 8)))
    (local.set $out (call $copy (local.get $out) (local.get $m) (local.get $m_len)))
    (local.set $out (call $copy (local.get $out) (i32.const 184) (i32.const 4)))
    (local.set $out (call $copy (local.get $out) (local.get $acc) (local.get $acc_len)))
    (call $log (i32.const 2048) (local.get $out))
    (local.set $promise
      (call $promise_create
        (call $p (local.get $acc_len)) (call $p (local.get $acc))
        (call $p (local.get $m_len)) (call $p (local.get $m))
        (i64.const 2) (i64.const 280)
        (i64.const 400) (global.get $GAS_20)))
    (call $current_account_id (i64.const 3))
    (local.set $self_len (call $register_len (i64.const 3)))
    (call $read_register (i64.const 3) (i64.const 8192))
    (call $promise_return
      (call $promise_then (local.get $promise)
        (local.get $self_len) (i64.const 8192)
        (i64.const 13) (i64.const 288)
        (i64.const 2) (i64.const 280)
        (i64.const 400) (global.get $GAS_20))))

  (func (export "on_other_done")
    (local $self_len i64) (local $ok i32)
    (call $current_account_id (i64.const 3))
    (call $predecessor_account_id (i64.const 4))
    (local.set $self_len (call $register_len (i64.const 3)))
    (call $read_register (i64.const 3) (i64.const 8192))
    (call $read_register (i64.const 4) (i64.const 8448))
    (if (i32.or
          (i64.ne (local.get $self_len) (call $register_len (i64.const 4)))
          (i32.eqz (call $eq (i32.const 8192) (i32.const 8448) (i32.wrap_i64 (local.get $self_len)))))
      (then (call $panic_utf8 (i64.const 38) (i64.const 112)) (unreachable)))
    (local.set $ok
      (i32.and
        (i64.eq (call $promise_results_count) (i64.const 1))
        (i64.eq (call $promise_result (i64.const 0) (i64.const 5)) (i64.const 1))))
    (if (local.get $ok)
      (then
        (drop (call $storage_write (i64.const 11) (i64.const 8) (i64.const 4) (i64.const 24) (i64.const 2)))
        (call $log_utf8 (i64.const 21) (i64.const 192))
        (call $value_return (i64.const 4) (i64.const 56)))
      (else
        (drop (call $storage_write (i64.const 11) (i64.const 8) (i64.const 8) (i64.const 32) (i64.const 2)))
        (call $log_utf8 (i64.const 47) (i64.const 224))
        (call $value_return (i64.const 5) (i64.const 64)))))
)
