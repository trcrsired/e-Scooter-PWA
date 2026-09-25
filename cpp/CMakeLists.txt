cmake_minimum_required(VERSION 3.20)
project(tuya_crypto_wasm LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 26)

add_executable(tuya_crypto.wasm tuya_crypto.cpp)

set(FAST_IO_DIR "" CACHE PATH "Path to fast_io installation")
if(FAST_IO_DIR)
    target_include_directories(tuya_crypto.wasm PRIVATE "${FAST_IO_DIR}/include")
endif()

target_compile_options(tuya_crypto.wasm PRIVATE -fno-exceptions -fno-rtti)

target_link_options(tuya_crypto.wasm PRIVATE
    -nostartfiles
    -Wl,--no-entry
    -Wl,--export=__wasm_call_ctors
    -Wl,--export=__wasm_call_dtors
    -Wl,--export=get_in_ptr
    -Wl,--export=get_out_ptr
    -Wl,--export=get_key_ptr
    -Wl,--export=get_md5_ptr
    -Wl,--export=get_buffer_size
    -Wl,--export=aes128_set_key
    -Wl,--export=aes128_encrypt
    -Wl,--export=aes128_decrypt
    -Wl,--export=md5_digest
)

install(TARGETS tuya_crypto.wasm RUNTIME DESTINATION .)
