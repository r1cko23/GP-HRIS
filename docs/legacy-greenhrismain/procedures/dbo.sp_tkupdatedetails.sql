
-- =============================================
-- Author:		Pat Relos
-- Create date:1-10-2026 9:47 pm
-- Description:	update uploaded time keep 
-- ============================================
create PROCEDURE [dbo].[sp_tkupdatedetails] 
	-- Add the parameters for the stored procedure here
	@idtimekeep int,
	@idemployee int, 
	@fname nvarchar(50),
	@lname nvarchar(50),
	@jobcode int,
	@iddepgroup INT, 
	@idclient int
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error

		update tbl_timekeeptemp
		set idposition = @jobcode,
		employeeid = @idemployee,
		fname2 = @fname, 
		lname2 = @lname,
		departmentcode= @iddepgroup,
		idclient = @idclient
		where idtimekeeptemp = @idtimekeep

		
		COMMIT TRANSACTION; -- Commit the transaction if everything is successful
	
	END TRY
	BEGIN CATCH
		IF @@TRANCOUNT > 0
			ROLLBACK TRANSACTION; -- Rollback the transaction in case of an error

		-- Log or handle the error as per your requirements
		-- Example: Raising an error and returning the error message to the caller
		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT 
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
		RETURN;
	END CATCH;
END
