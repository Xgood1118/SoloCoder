package com.cms.service;

import com.cms.dto.CommentDTO;
import com.cms.dto.CreateCommentRequest;
import com.cms.entity.Comment;
import com.cms.entity.User;
import com.cms.entity.UserRole;
import com.cms.repository.CommentRepository;
import com.cms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final UserRepository userRepository;

    public List<CommentDTO> getCommentsByDocumentId(String documentId) {
        List<Comment> comments = commentRepository.findByDocumentId(documentId);
        return buildCommentTree(comments);
    }

    public CommentDTO createComment(CreateCommentRequest request, String userId) {
        Comment comment = new Comment();
        comment.setDocumentId(request.getDocumentId());
        comment.setUserId(userId);
        comment.setContent(request.getContent());
        comment.setParentId(request.getParentId());
        comment.setReplyToUserId(request.getReplyToUserId());
        Comment saved = commentRepository.save(comment);
        return toDTO(saved);
    }

    public void deleteComment(String id, String userId) {
        Comment comment = commentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Comment not found: " + id));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        if (!comment.getUserId().equals(userId) && user.getRole() != UserRole.ADMIN) {
            throw new RuntimeException("Only the author or admin can delete this comment");
        }
        List<Comment> children = commentRepository.findByParentId(id);
        for (Comment child : children) {
            commentRepository.delete(child);
        }
        commentRepository.delete(comment);
    }

    public void likeComment(String id) {
        Comment comment = commentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Comment not found: " + id));
        comment.setLikeCount(comment.getLikeCount() + 1);
        commentRepository.save(comment);
    }

    private List<CommentDTO> buildCommentTree(List<Comment> comments) {
        Map<String, CommentDTO> dtoMap = new LinkedHashMap<>();
        for (Comment c : comments) {
            dtoMap.put(c.getId(), toDTO(c));
        }
        List<CommentDTO> roots = new ArrayList<>();
        for (Comment c : comments) {
            CommentDTO dto = dtoMap.get(c.getId());
            if (c.getParentId() == null || !dtoMap.containsKey(c.getParentId())) {
                roots.add(dto);
            } else {
                dtoMap.get(c.getParentId()).getChildren().add(dto);
            }
        }
        return roots;
    }

    private CommentDTO toDTO(Comment comment) {
        CommentDTO dto = new CommentDTO();
        dto.setId(comment.getId());
        dto.setDocumentId(comment.getDocumentId());
        dto.setUserId(comment.getUserId());
        dto.setContent(comment.getContent());
        dto.setParentId(comment.getParentId());
        dto.setLikeCount(comment.getLikeCount());
        dto.setReplyToUserId(comment.getReplyToUserId());
        dto.setCreatedAt(comment.getCreatedAt());
        dto.setUpdatedAt(comment.getUpdatedAt());
        return dto;
    }
}
