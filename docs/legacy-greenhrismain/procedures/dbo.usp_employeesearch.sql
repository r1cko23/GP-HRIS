
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	Search Employee List
-- =============================================
CREATE PROCEDURE [dbo].[usp_employeesearch] 
	-- Add the parameters for the stored procedure here
	@idemployee Int	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error
			SELECT 
    employee_id,
    salutation,
    fname,
    mname,
    lname,
    position1,
    sex,
    date_birth,
    status,
    pstatus,
    height,
    inches,
    weight,
    religion,
    idclient,
    idclientbranch,
    department_code,
    departmentsub,
    employee_status,
    tax_status,
    datehired,
    contractend,
    dateregular,
    date_resigned,
    dailyrate,
    billingdailyrate,
    ecola,
    SSSno,
    SSSstatus,
    medical,
    TINno,
    tinstatus,
    philhealthno,
    philhealthstatus,
    GSISno,
    pagibigno,
    pagibigstatus,
    nbino,
    nbistatus,
    paythrough,
    bankaccountno,
    bankname,
    atmstatus,
    pri_address,
    province,
    pri_city,
    sec_address,
    sec_city,
    pri_mobile,
    pri_contact,
    pri_email,
    region,
    statusrequirement,
    remarks,
    finalpaystatus,
    policeclearance,
    brgyclearance,
    healthpermit,
    mayorspermit,
    drugtest,
    twoone,
    gcash,
    picturesname,
	verificationstatus,
    createdby,
    createddate,
    updateby,
    lastupdate
FROM employee
WHERE employee_id = @idemployee
  AND (
        verificationstatus IS NULL
        OR verificationstatus = 'Verified'
      );
		
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
