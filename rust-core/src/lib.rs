use std::alloc::{alloc, dealloc, Layout};
use std::slice;

/// Allocates `len` bytes in linear WASM memory for zero-copy JS -> Rust transfers.
#[no_mangle]
pub extern "C" fn alloc_buf(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let Ok(layout) = Layout::from_size_align(len, 1) else {
        return std::ptr::null_mut();
    };
    unsafe { alloc(layout) }
}

/// Frees a buffer previously returned by `alloc_buf`.
#[no_mangle]
pub extern "C" fn free_buf(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    if let Ok(layout) = Layout::from_size_align(len, 1) {
        unsafe { dealloc(ptr, layout) };
    }
}

/// Fast IEEE 802.3 CRC-32 checksum computed over `[ptr .. ptr + len]`.
#[no_mangle]
pub extern "C" fn crc32_fast(ptr: *const u8, len: usize) -> u32 {
    if ptr.is_null() || len == 0 {
        return 0;
    }
    let data = unsafe { slice::from_raw_parts(ptr, len) };
    let mut crc: u32 = 0xFFFF_FFFF;
    for &b in data {
        crc ^= b as u32;
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

/// Fast 64-bit FNV-1a content digest for instant buffer fingerprinting.
#[no_mangle]
pub extern "C" fn fnv1a64_fast(ptr: *const u8, len: usize) -> u64 {
    if ptr.is_null() {
        return 0xcbf2_9ce4_8422_2325;
    }
    let data = unsafe { slice::from_raw_parts(ptr, len) };
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for &b in data {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    hash
}

#[inline(always)]
fn ascii_lower(b: u8) -> u8 {
    if b.is_ascii_uppercase() { b + 32 } else { b }
}

/// Case-insensitive subsequence & word-prefix fuzzy matcher returning a 0..1000+ relevance score.
#[no_mangle]
pub extern "C" fn fuzzy_match_score(
    query_ptr: *const u8,
    query_len: usize,
    target_ptr: *const u8,
    target_len: usize,
) -> u32 {
    if query_ptr.is_null() || target_ptr.is_null() || query_len == 0 || target_len == 0 {
        return 0;
    }
    let query = unsafe { slice::from_raw_parts(query_ptr, query_len) };
    let target = unsafe { slice::from_raw_parts(target_ptr, target_len) };

    let mut qi = 0usize;
    let mut score: u32 = 0;
    let mut streak: u32 = 0;
    let mut prev_sep = true;

    for (ti, &tb) in target.iter().enumerate() {
        if qi >= query_len {
            break;
        }
        let qc = ascii_lower(query[qi]);
        let tc = ascii_lower(tb);
        if qc == tc {
            streak += 1;
            score += 10 + streak * 6;
            if ti == 0 || prev_sep {
                score += 25;
            }
            qi += 1;
        } else {
            streak = 0;
        }
        prev_sep = tb == b' ' || tb == b'-' || tb == b'_' || tb == b'/';
    }

    if qi < query_len {
        return 0;
    }

    score.saturating_add(1000 / ((target_len as u32).max(1)))
}
