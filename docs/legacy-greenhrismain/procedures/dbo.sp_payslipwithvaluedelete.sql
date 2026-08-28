
create PROCEDURE [dbo].[sp_payslipwithvaluedelete]
    @uname NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRAN;

        DELETE FROM otchart
        WHERE uname = @uname;

        COMMIT TRAN;

        -- Optional: return affected rows
        SELECT @@ROWCOUNT AS RowsDeleted;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRAN;

        -- Return error info
        SELECT 
            ERROR_MESSAGE() AS ErrorMessage,
            ERROR_LINE() AS ErrorLine;
    END CATCH
END