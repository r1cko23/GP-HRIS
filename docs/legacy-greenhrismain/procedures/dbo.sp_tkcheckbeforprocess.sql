
create PROCEDURE [dbo].[sp_tkcheckbeforprocess] 
(
  
    @datestart  DATE,
	@idclient int,
	@iddepgroup int,
	@uname  nvarchar(50)


)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @counterror1 INT;
		

            ---------------------------------------------------
            -- Check if if there is still an erro 
            ---------------------------------------------------
            SET @counterror1 = NULL;   

          SELECT employeeid
			FROM tbl_timekeeptemp
			WHERE statustemp LIKE '%Invalid Employee ID%' OR statustemp  LIKE '%Name Mismatch%' OR statustemp  LIKE '%Invalid Job Code%' 
			OR statustemp  LIKE '%Invalid ID Client%'
			OR statustemp LIKE  '%Invalid Dept/Group%'
			OR STATUSTEMP LIKE '%Dept/Group Mismatch%'
			


        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE 
            @ErrorMessage  NVARCHAR(4000),
            @ErrorSeverity INT,
            @ErrorState    INT;

        SELECT 
            @ErrorMessage  = ERROR_MESSAGE(),
            @ErrorSeverity = ERROR_SEVERITY(),
            @ErrorState    = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
        RETURN;

    END CATCH;
END
