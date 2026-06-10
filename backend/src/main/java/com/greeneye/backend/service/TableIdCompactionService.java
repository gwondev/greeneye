package com.greeneye.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 삭제 후 PK를 1부터 연속으로 다시 매깁니다 (AUTO_INCREMENT 갭 제거).
 * FK 참조 테이블 순서: users/modules → disposal_records → reward_histories
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TableIdCompactionService {

    private static final long ID_OFFSET = 1_000_000L;

    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void compactAllAfterDelete() {
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS=0");
        try {
            compactUsers();
            compactModules();
            compactDisposalRecords();
            compactRewardHistories();
            log.info("table id compaction completed");
        } finally {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS=1");
        }
    }

    private void compactUsers() {
        List<Long> ids = jdbcTemplate.queryForList("SELECT id FROM users ORDER BY id", Long.class);
        if (ids.isEmpty()) {
            resetAutoIncrement("users", 1);
            return;
        }

        jdbcTemplate.update("UPDATE users SET id = id + ?", ID_OFFSET);
        jdbcTemplate.update("UPDATE disposal_records SET user_id = user_id + ? WHERE user_id IS NOT NULL", ID_OFFSET);
        jdbcTemplate.update("UPDATE reward_histories SET user_id = user_id + ? WHERE user_id IS NOT NULL", ID_OFFSET);

        long nextId = 1;
        for (Long oldId : ids) {
            long tempId = oldId + ID_OFFSET;
            jdbcTemplate.update("UPDATE users SET id = ? WHERE id = ?", nextId, tempId);
            jdbcTemplate.update("UPDATE disposal_records SET user_id = ? WHERE user_id = ?", nextId, tempId);
            jdbcTemplate.update("UPDATE reward_histories SET user_id = ? WHERE user_id = ?", nextId, tempId);
            nextId++;
        }
        resetAutoIncrement("users", nextId);
    }

    private void compactModules() {
        List<Long> ids = jdbcTemplate.queryForList("SELECT id FROM modules ORDER BY id", Long.class);
        if (ids.isEmpty()) {
            resetAutoIncrement("modules", 1);
            return;
        }

        jdbcTemplate.update("UPDATE modules SET id = id + ?", ID_OFFSET);
        jdbcTemplate.update("UPDATE disposal_records SET module_id = module_id + ? WHERE module_id IS NOT NULL", ID_OFFSET);

        long nextId = 1;
        for (Long oldId : ids) {
            long tempId = oldId + ID_OFFSET;
            jdbcTemplate.update("UPDATE modules SET id = ? WHERE id = ?", nextId, tempId);
            jdbcTemplate.update("UPDATE disposal_records SET module_id = ? WHERE module_id = ?", nextId, tempId);
            nextId++;
        }
        resetAutoIncrement("modules", nextId);
    }

    private void compactDisposalRecords() {
        List<Long> ids = jdbcTemplate.queryForList("SELECT id FROM disposal_records ORDER BY id", Long.class);
        if (ids.isEmpty()) {
            resetAutoIncrement("disposal_records", 1);
            return;
        }

        jdbcTemplate.update("UPDATE disposal_records SET id = id + ?", ID_OFFSET);
        jdbcTemplate.update(
                "UPDATE reward_histories SET disposal_record_id = disposal_record_id + ? WHERE disposal_record_id IS NOT NULL",
                ID_OFFSET
        );

        long nextId = 1;
        for (Long oldId : ids) {
            long tempId = oldId + ID_OFFSET;
            jdbcTemplate.update("UPDATE disposal_records SET id = ? WHERE id = ?", nextId, tempId);
            jdbcTemplate.update(
                    "UPDATE reward_histories SET disposal_record_id = ? WHERE disposal_record_id = ?",
                    nextId,
                    tempId
            );
            nextId++;
        }
        resetAutoIncrement("disposal_records", nextId);
    }

    private void compactRewardHistories() {
        List<Long> ids = jdbcTemplate.queryForList("SELECT id FROM reward_histories ORDER BY id", Long.class);
        if (ids.isEmpty()) {
            resetAutoIncrement("reward_histories", 1);
            return;
        }

        jdbcTemplate.update("UPDATE reward_histories SET id = id + ?", ID_OFFSET);

        long nextId = 1;
        for (Long oldId : ids) {
            long tempId = oldId + ID_OFFSET;
            jdbcTemplate.update("UPDATE reward_histories SET id = ? WHERE id = ?", nextId, tempId);
            nextId++;
        }
        resetAutoIncrement("reward_histories", nextId);
    }

    private void resetAutoIncrement(String table, long nextValue) {
        jdbcTemplate.execute("ALTER TABLE " + table + " AUTO_INCREMENT = " + nextValue);
    }
}
